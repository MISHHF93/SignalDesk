import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

/**
 * The shared button primitive. Consolidates what used to be four
 * independently-styled buttons (`.cardActionButton`, `.authSubmit`,
 * `.connectorLink`, `.clearViewButton`) into one component with a small
 * variant set, so hover/pressed/disabled states are defined once.
 */
export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props} />;
}
