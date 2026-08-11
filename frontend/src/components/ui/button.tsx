import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Botões em pílula, como no site da Capela.
 *
 * `default` é a ação da vez (azul do manto no claro, dourado no escuro) e
 * `gold` é o convite — o gradiente dourado com brilho, reservado para a
 * chamada principal de uma tela (entrar, criar a primeira playlist…).
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full',
    'text-sm font-semibold select-none',
    'transition-[background-color,color,box-shadow,border-color,transform] duration-200',
    'disabled:pointer-events-none disabled:opacity-55',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'active:scale-[0.97]',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-raised',
        gold: 'bg-[image:var(--gradient-gold)] text-navy-900 shadow-gilded hover:brightness-105',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90',
        outline:
          'border border-[var(--color-outline)] bg-transparent text-foreground hover:border-gold-500 hover:bg-[var(--color-surface-hover)]',
        /**
         * Contornado sobre o azul do manto (faixas de cabeçalho, tela de
         * entrada). Não dá para usar `outline` ali: os tokens seguem o tema do
         * app, então a borda sairia escura — invisível sobre o azul.
         */
        'outline-dark':
          'border border-white/40 bg-transparent text-ivory hover:border-gold-400 hover:bg-white/10',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[var(--color-surface-container-highest)]',
        ghost: 'text-foreground hover:bg-[var(--color-surface-hover)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 px-4 text-[0.8125rem]',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
