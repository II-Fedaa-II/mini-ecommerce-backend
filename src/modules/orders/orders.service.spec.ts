import {
  EmptyCartException,
  InsufficientStockException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';

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

  beforeEach(() => {
    usersService = {
      getCart: jest.fn(),
      clearCart: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    productsService = {
      findManyByIds: jest.fn(),
      decrementManyStock: jest.fn(),
    } as unknown as jest.Mocked<ProductsService>;
    ordersRepository = {
      create: jest.fn(),
      findById: jest.fn(),
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
    usersService.getCart.mockResolvedValue([
      {
        productId: { toString: () => 'product-1' },
        quantity: 99,
        selectedVariants: [],
      } as any,
    ]);
    productsService.findManyByIds.mockResolvedValue([product]);

    await expect(service.checkout('user-1')).rejects.toThrow(
      InsufficientStockException,
    );
    expect(ordersRepository.create).not.toHaveBeenCalled();
    expect(usersService.clearCart).not.toHaveBeenCalled();
  });

  it('creates the order, decrements stock in one batched call, and clears the cart', async () => {
    usersService.getCart.mockResolvedValue([
      {
        productId: { toString: () => 'product-1' },
        quantity: 2,
        selectedVariants: [],
      } as any,
    ]);
    productsService.findManyByIds.mockResolvedValue([product]);
    ordersRepository.create.mockResolvedValue({
      _id: { toString: () => 'order-1' },
      items: [],
      total: 20,
      get: () => new Date(),
    } as any);

    const result = await service.checkout('user-1');

    expect(ordersRepository.create).toHaveBeenCalledTimes(1);
    expect(productsService.decrementManyStock).toHaveBeenCalledTimes(1);
    expect(productsService.decrementManyStock).toHaveBeenCalledWith([
      { productId: 'product-1', amount: 2 },
    ]);
    expect(usersService.clearCart).toHaveBeenCalledWith('user-1');
    expect(result.total).toBe(20);
  });
});
