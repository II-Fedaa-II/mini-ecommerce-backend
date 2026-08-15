import {
  InsufficientStockException,
  InvalidVariantSelectionException,
} from '../../common/exceptions/domain.exceptions';
import { ProductsService } from '../products/products.service';
import { UsersService } from '../users/users.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;
  let usersService: jest.Mocked<UsersService>;
  let productsService: jest.Mocked<ProductsService>;

  const product = {
    _id: { toString: () => 'product-1' },
    title: 'Test Product',
    price: 10,
    stock: 5,
    variants: [{ name: 'Size', options: ['S', 'M'] }],
  } as any;

  beforeEach(() => {
    usersService = {
      getCart: jest.fn(),
      addCartItem: jest.fn(),
      updateCartItem: jest.fn(),
      removeCartItem: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    productsService = {
      findDocumentOrThrow: jest.fn(),
      findManyByIds: jest.fn(),
    } as unknown as jest.Mocked<ProductsService>;

    service = new CartService(usersService, productsService);
  });

  describe('addItem', () => {
    it('adds the item when stock and variant selection are valid', async () => {
      productsService.findDocumentOrThrow.mockResolvedValue(product);
      usersService.addCartItem.mockResolvedValue([]);
      productsService.findManyByIds.mockResolvedValue([]);

      await service.addItem('user-1', {
        productId: 'product-1',
        quantity: 2,
        selectedVariants: [{ name: 'Size', value: 'M' }],
      });

      expect(usersService.addCartItem).toHaveBeenCalledWith(
        'user-1',
        'product-1',
        2,
        [{ name: 'Size', value: 'M' }],
      );
    });

    it('rejects a quantity above available stock', async () => {
      productsService.findDocumentOrThrow.mockResolvedValue(product);

      await expect(
        service.addItem('user-1', { productId: 'product-1', quantity: 99 }),
      ).rejects.toThrow(InsufficientStockException);
      expect(usersService.addCartItem).not.toHaveBeenCalled();
    });

    it('rejects a variant value that does not exist on the product', async () => {
      productsService.findDocumentOrThrow.mockResolvedValue(product);

      await expect(
        service.addItem('user-1', {
          productId: 'product-1',
          quantity: 1,
          selectedVariants: [{ name: 'Size', value: 'XL' }],
        }),
      ).rejects.toThrow(InvalidVariantSelectionException);
    });
  });

  describe('getCart', () => {
    it('prices every line from a single batched product lookup', async () => {
      usersService.getCart.mockResolvedValue([
        {
          _id: { toString: () => 'item-1' },
          productId: { toString: () => 'product-1' },
          quantity: 2,
          selectedVariants: [],
        } as any,
      ]);
      productsService.findManyByIds.mockResolvedValue([product]);

      const result = await service.getCart('user-1');

      expect(productsService.findManyByIds).toHaveBeenCalledTimes(1);
      expect(result.total).toBe(20);
      expect(result.items[0].title).toBe('Test Product');
    });
  });
});
