/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/ui/Button.tsx
 * O que faz: o botão do jogo, em três pesos. "solid" é a ação principal (um
 * bloco de tinta), "outline" é a ação secundária e "danger" é o que não tem volta.
 * Vem em dois tamanhos: "normal" e "small", para listas com muitos botões.
 */

import type { ButtonHTMLAttributes } from 'react';

// =============================================================================
// =============================================================================
// B O T Ã O

type ButtonVariant = 'solid' | 'outline' | 'danger';
type ButtonSize = 'normal' | 'small';

const BASE_CLASS =
  'inline-flex items-center justify-center gap-1.5 border-2 font-semibold ' +
  'leading-tight transition-transform active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  normal: 'px-3 py-1.5 text-sm',
  small: 'px-2 py-1 text-xs',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'border-tinta bg-tinta text-jornal hover:bg-tinta/85',
  outline: 'border-tinta bg-transparent text-tinta hover:bg-tinta/10',
  danger: 'border-urucum bg-urucum text-jornal hover:bg-urucum/85',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Botão com o estilo do jogo. Aceita tudo que um <button> aceita.
export function Button({
  variant = 'outline',
  size = 'normal',
  className = '',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BASE_CLASS} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...buttonProps}
    />
  );
}
