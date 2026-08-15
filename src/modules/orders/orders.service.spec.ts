import {
  EmptyCartException,
  InsufficientStockException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { OrdersService } from './orders.service';
import {
  DUPLICATE_KEY_ERROR,
  OrdersRepository,
} from './repositories/orders.repository';

describe('OrdersService', () => {
  let service: OrdersService;
  let usersService: jest.Mocked<UsersService>;
  let productsService: jest.Mocked<ProductsService>;
  let ordersRepository: jest.Mocked<OrdersRepository>;

  const product = {
    _id: { toString: () => 'product-1' },
    title: 'Test Product',
    price: 10,
    stock: 5,
  } as any;

  const cartLine = {
    productId: { toString: () => 'product-1' },
    quantity: 2,
    selectedVariants: [],
  } as any;

  const persistedOrder = {
    _id: { toString: () => 'order-1' },
    items: [],
    total: 20,
    get: () => new Date(),
  } as any;

  beforeEach(() => {
    usersService = {
      getCart: jest.fn(),
      clearCart: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    productsService = {
      findManyByIds: jest.fn(),
      // One line in the fixtures, so a successful claim returns exactly that line.
      decrementManyStock: jest
        .fn()
        .mockResolvedValue([{ productId: 'product-1', amount: 2 }]),
      restoreManyStock: jest.fn(),
    } as unknown as jest.Mocked<ProductsService>;

    ordersRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<OrdersRepository>;

    service = new OrdersService(
      usersService,
      productsService,
      ordersRepository,
    );
  });

  it('throws EmptyCartException when the cart has no items', async () => {
    usersService.getCart.mockResolvedValue([]);
    await expect(service.checkout('user-1')).rejects.toThrow(
      EmptyCartException,
    );
    expect(ordersRepository.create).not.toHaveBeenCalled();
  });

  it('throws InsufficientStockException and creates nothing when a line exceeds stock', async () => {
    usersService.getCart.mockResolvedValue([{ ...cartLine, quantity: 99 }]);
    productsService.findManyByIds.mockResolvedValue([product]);

    await expect(service.checkout('user-1')).rejects.toThrow(
      InsufficientStockException,
    );
    expect(ordersRepository.create).not.toHaveBeenCalled();
    expect(usersService.clearCart).not.toHaveBeenCalled();
  });

  it('creates the order, claims stock in one batched call, and clears the cart', async () => {
    usersService.getCart.mockResolvedValue([cartLine]);
    productsService.findManyByIds.mockResolvedValue([product]);
    ordersRepository.create.mockResolvedValue(persistedOrder);

    const result = await service.checkout('user-1');

    expect(ordersRepository.create).toHaveBeenCalledTimes(1);
    expect(productsService.decrementManyStock).toHaveBeenCalledTimes(1);
    expect(productsService.decrementManyStock).toHaveBeenCalledWith([
      { productId: 'product-1', amount: 2 },
    ]);
    expect(usersService.clearCart).toHaveBeenCalledWith('user-1');
    expect(productsService.restoreManyStock).not.toHaveBeenCalled();
    expect(result.total).toBe(20);
  });

  describe('concurrency', () => {
    it('refuses the order and restores stock when another checkout took it first', async () => {
      usersService.getCart.mockResolvedValue([cartLine]);
      productsService.findManyByIds.mockResolvedValue([product]);
      // The conditional decrement matched nothing — someone else got there first.
      productsService.decrementManyStock.mockResolvedValue([]);

      await expect(service.checkout('user-1')).rejects.toThrow(
        InsufficientStockException,
      );

      expect(ordersRepository.create).not.toHaveBeenCalled();
      expect(usersService.clearCart).not.toHaveBeenCalled();
      // Nothing was claimed, so nothing may be handed back — restoring an unclaimed
      // line would invent stock that never existed.
      expect(productsService.restoreManyStock).toHaveBeenCalledWith([]);
    });

    it('gives stock back when persisting the order fails', async () => {
      usersService.getCart.mockResolvedValue([cartLine]);
      productsService.findManyByIds.mockResolvedValue([product]);
      ordersRepository.create.mockRejectedValue(new Error('database is down'));

      await expect(service.checkout('user-1')).rejects.toThrow(
        'database is down',
      );

      expect(productsService.restoreManyStock).toHaveBeenCalledWith([
        { productId: 'product-1', amount: 2 },
      ]);
      expect(usersService.clearCart).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('returns the original order for a repeated key without charging again', async () => {
      ordersRepository.findByIdempotencyKey.mockResolvedValue(persistedOrder);

      const result = await service.checkout('user-1', 'key-123');

      expect(result.id).toBe('order-1');
      expect(ordersRepository.create).not.toHaveBeenCalled();
      expect(productsService.decrementManyStock).not.toHaveBeenCalled();
      expect(usersService.clearCart).not.toHaveBeenCalled();
    });

    it('passes the key through so the unique index can enforce it', async () => {
      usersService.getCart.mockResolvedValue([cartLine]);
      productsService.findManyByIds.mockResolvedValue([product]);
      ordersRepository.create.mockResolvedValue(persistedOrder);

      await service.checkout('user-1', 'key-123');

      expect(ordersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'key-123' }),
      );
    });

    it('returns the winner and restores stock when two requests race the same key', async () => {
      usersService.getCart.mockResolvedValue([cartLine]);
      productsService.findManyByIds.mockResolvedValue([product]);

      // Nothing on record at lookup time, then the unique index rejects this writer.
      ordersRepository.findByIdempotencyKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(persistedOrder);
      ordersRepository.create.mockRejectedValue({ code: DUPLICATE_KEY_ERROR });

      const result = await service.checkout('user-1', 'key-123');

      expect(result.id).toBe('order-1');
      expect(productsService.restoreManyStock).toHaveBeenCalledWith([
        { productId: 'product-1', amount: 2 },
      ]);
    });
  });
});
