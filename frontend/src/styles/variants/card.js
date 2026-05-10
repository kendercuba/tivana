import { tv } from 'tailwind-variants';

export const card = tv({
  base: 'bg-white p-6 rounded-lg shadow',
  variants: {
    padding: {
      sm: 'p-4',
      base: 'p-6',
      lg: 'p-8',
    },
    shadow: {
      none: 'shadow-none',
      base: 'shadow',
      md: 'shadow-md',
      lg: 'shadow-lg',
    },
    rounded: {
      sm: 'rounded',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-2xl',
    },
  },
  defaultVariants: {
    padding: 'base',
    shadow: 'base',
    rounded: 'lg',
  },
});
