// src/components/ui/Button.jsx
import { button } from '../../styles/variants/button';

export default function Button({ children, intent, full, size, ...props }) {
  return (
    <button className={button({ intent, full, size })} {...props}>
      {children}
    </button>
  );
}
