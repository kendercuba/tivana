// src/styles/variants/button.js
import { tv } from 'tailwind-variants';

export const button = tv({
  base: 'px-4 py-2 rounded font-semibold transition duration-200 focus:outline-none',
  variants: {
    intent: {
      primary: 'bg-yellow-400 text-black hover:bg-yellow-500',
      secondary: 'bg-white text-gray-800 border hover:bg-gray-50',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      success: 'bg-green-600 text-white hover:bg-green-700',
    },
    full: {
      true: 'w-full',
    },
    size: {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    intent: 'primary',
    size: 'base',
  },
});
