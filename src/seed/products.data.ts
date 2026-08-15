import { CreateProductData } from '../modules/products/repositories/products.repository';

export const SEED_PRODUCTS: CreateProductData[] = [
  {
    title: 'Classic Cotton T-Shirt',
    imageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop',
    description: 'A breathable, everyday cotton t-shirt with a relaxed fit.',
    price: 19.99,
    stock: 42,
    variants: [
      { name: 'Size', options: ['S', 'M', 'L', 'XL'] },
      { name: 'Color', options: ['Black', 'White', 'Navy'] },
    ],
  },
  {
    title: 'Slim Fit Denim Jeans',
    imageUrl:
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80&auto=format&fit=crop',
    description:
      'Stretch denim jeans with a modern slim fit and reinforced stitching.',
    price: 54.5,
    stock: 30,
    variants: [
      { name: 'Size', options: ['30', '32', '34', '36'] },
      { name: 'Wash', options: ['Light', 'Dark'] },
    ],
  },
  {
    title: 'Running Sneakers',
    imageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80&auto=format&fit=crop',
    description:
      'Lightweight running shoes with cushioned soles for daily training.',
    price: 89.0,
    stock: 25,
    variants: [
      { name: 'Size', options: ['8', '9', '10', '11'] },
      { name: 'Color', options: ['Grey', 'Red'] },
    ],
  },
  {
    title: 'Leather Wallet',
    imageUrl:
      'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80&auto=format&fit=crop',
    description: 'Slim bifold wallet crafted from genuine full-grain leather.',
    price: 34.0,
    stock: 60,
    variants: [],
  },
  {
    title: 'Stainless Steel Water Bottle',
    imageUrl:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80&auto=format&fit=crop',
    description: 'Insulated 750ml bottle that keeps drinks cold for 24 hours.',
    price: 24.99,
    stock: 75,
    variants: [{ name: 'Color', options: ['Silver', 'Black', 'Teal'] }],
  },
  {
    title: 'Wireless Earbuds',
    imageUrl:
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80&auto=format&fit=crop',
    description:
      'True wireless earbuds with active noise cancellation and 30h battery life.',
    price: 79.99,
    stock: 18,
    variants: [],
  },
  {
    title: 'Canvas Backpack',
    imageUrl:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80&auto=format&fit=crop',
    description: 'Durable canvas backpack with a padded laptop sleeve.',
    price: 46.0,
    stock: 22,
    variants: [{ name: 'Color', options: ['Olive', 'Charcoal', 'Sand'] }],
  },
  {
    title: 'Wool Blend Beanie',
    imageUrl:
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&q=80&auto=format&fit=crop',
    description: 'Soft wool blend beanie for cold-weather everyday wear.',
    price: 14.99,
    stock: 90,
    variants: [{ name: 'Color', options: ['Grey', 'Black', 'Burgundy'] }],
  },
  {
    title: 'Ceramic Coffee Mug',
    imageUrl:
      'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80&auto=format&fit=crop',
    description: '12oz ceramic mug, microwave and dishwasher safe.',
    price: 9.99,
    stock: 120,
    variants: [],
  },
  {
    title: 'Polarized Sunglasses',
    imageUrl:
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80&auto=format&fit=crop',
    description: 'UV400 polarized sunglasses with a lightweight acetate frame.',
    price: 39.99,
    stock: 33,
    variants: [{ name: 'Frame Color', options: ['Black', 'Tortoise'] }],
  },
  {
    title: 'Yoga Mat',
    imageUrl:
      'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=800&q=80&auto=format&fit=crop',
    description: 'Non-slip 6mm yoga mat with a carrying strap.',
    price: 27.5,
    stock: 40,
    variants: [{ name: 'Color', options: ['Purple', 'Teal', 'Grey'] }],
  },
  {
    title: 'Mechanical Keyboard',
    imageUrl:
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80&auto=format&fit=crop',
    description:
      'Tactile mechanical keyboard with hot-swappable switches and RGB backlighting.',
    price: 99.0,
    stock: 15,
    variants: [{ name: 'Switch Type', options: ['Red', 'Brown', 'Blue'] }],
  },
  {
    title: 'Desk Lamp',
    imageUrl:
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80&auto=format&fit=crop',
    description: 'Adjustable LED desk lamp with three brightness levels.',
    price: 32.0,
    stock: 28,
    variants: [],
  },
  {
    title: 'Linen Throw Pillow Cover',
    imageUrl:
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80&auto=format&fit=crop',
    description: '18x18 inch linen pillow cover with a hidden zipper closure.',
    price: 12.99,
    stock: 55,
    variants: [{ name: 'Color', options: ['Natural', 'Charcoal', 'Blush'] }],
  },
  {
    title: 'Aluminum Laptop Stand',
    imageUrl:
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format&fit=crop',
    description:
      'Ergonomic, foldable aluminum stand compatible with most laptops.',
    price: 29.99,
    stock: 37,
    variants: [],
  },
];
