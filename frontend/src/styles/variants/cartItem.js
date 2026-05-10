import { tv } from 'tailwind-variants';

export const cartItem = tv({
  slots: {
    base: 'flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4',
    imageSection: 'flex items-center gap-4 w-full md:w-3/4',
  }
});
