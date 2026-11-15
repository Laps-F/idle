/*
 * Encantados - idle de coleção com folclore brasileiro
 * Arquivo: src/components/ui/Button.tsx
 * O que faz: o botão do jogo, em três pesos. "solid" é a ação principal (um
 * bloco de tinta), "outline" é a ação secundária e "danger" é o que não tem volta.
 */

import type { ButtonHTMLAttributes } from 'react';

// =============================================================================
// =============================================================================
// B O T Ã O

type ButtonVariant = 'solid' | 'outline' | 'danger';

const BASE_CLASS =
  'inline-flex items-center justify-center gap-1.5 border-2 px-3 py-1.5 text-sm font-semibold ' +
  'leading-tight transition-transform active:translate-y-px ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  solid: 'border-tinta bg-tinta text-jornal hover:bg-tinta/85',
  outline: 'border-tinta bg-transparent text-tinta hover:bg-tinta/10',
  danger: 'border-urucum bg-urucum text-jornal hover:bg-urucum/85',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Botão com o estilo do jogo. Aceita tudo que um <button> aceita.
export function Button({ variant = 'outline', className = '', ...buttonProps }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BASE_CLASS} ${VARIANT_CLASSES[variant]} ${className}`}
      {...buttonProps}
    />
  );
}
