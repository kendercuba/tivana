import { card } from '../../styles/variants/card';

export default function Card({ children, padding, shadow, rounded, className = '', ...props }) {
  return (
    <div className={`${card({ padding, shadow, rounded })} ${className}`} {...props}>
      {children}
    </div>
  );
}
