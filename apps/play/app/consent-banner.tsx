import { ConsentManagerDialog, CookieBanner } from "@c15t/nextjs";

// Theme configuration object
const themeColors = {
  white: "#FFFFFF",
  black: "#000000",
  textLight: "#E2E2E2",
  gradientBackground: "linear-gradient(to right, rgb(255 255 255 / 0.8) , rgb(255 255 255 / 1))",
  borderRadius: "0.5rem",
} as const;

// Derived theme values
const themeConfig = {
  bgColor: themeColors.white,
  bgColorDark: themeColors.black,
  primaryColor: themeColors.white,
  primaryColorHover: themeColors.white,
  textColor: themeColors.textLight,
  get focusRing() {
    return `${this.primaryColor} !important`;
  },
  get focusShadow() {
    return `0 0 0 2px ${this.primaryColor}`;
  },
} as const;

export function ConsentBanner() {
  const { bgColor, bgColorDark, primaryColor, primaryColorHover, focusRing, focusShadow } =
    themeConfig;

  const baseTheme = {
    style: {
      "--button-focus-ring-dark": primaryColor,
      "--button-focus-ring": primaryColor,
      "--button-primary-dark": primaryColor,
      "--button-primary": primaryColor,
      "--button-shadow-primary-dark": `var(--button-shadow-dark), inset 0 0 0 1px ${primaryColor}`,
      "--button-shadow-primary-focus-dark": focusShadow,
      "--button-shadow-primary-focus": focusShadow,
      "--button-shadow-primary": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
      "--button-primary-hover-dark": primaryColorHover,
      "--button-primary-hover": primaryColorHover,
      "--button-border-radius": themeColors.borderRadius,
    },
  };

  return (
    <>
      <CookieBanner
        theme={{
          "banner.root": {
            style: {
              ...baseTheme.style,
            },
          },
          "banner.footer.accept-button": {
            style: {
              "--button-background-color-dark": "#FFFFFF",
              "--button-primary-dark": "#000000",
              "--button-primary-hover-dark": "#FFF",
            },
          },
        }}
      />
      <ConsentManagerDialog
        theme={{
          "dialog.root": {
            style: {
              ...baseTheme.style,
              "--accordion-focus-ring-dark": focusRing,
              "--accordion-focus-ring": focusRing,
              "--accordion-focus-shadow-dark": focusShadow,
              "--accordion-focus-shadow": focusShadow,
              "--dialog-background-color-dark": bgColorDark,
              "--dialog-background-color": bgColor,
              "--dialog-branding-focus-color-dark": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
              "--dialog-branding-focus-color": `var(--button-shadow), inset 0 0 0 1px ${primaryColor}`,
              "--dialog-footer-background-color-dark": bgColorDark,
              "--switch-background-color-checked-dark": primaryColor,
              "--switch-background-color-checked": primaryColor,
              "--switch-background-color-unchecked-dark": bgColorDark,
              "--switch-background-color-unchecked": bgColor,
              "--switch-focus-shadow-dark": focusShadow,
              "--switch-focus-shadow": focusShadow,
              "--widget-accordion-background-color-dark": bgColorDark,
              "--widget-accordion-background-color": bgColor,
            },
          },
          "widget.footer.save-button": {
            style: {
             "--button-background-color-dark": "#FFFFFF",
              "--button-primary-hover-dark": "#FFF",
            },
          },
        }}
      />
    </>
  );
}
