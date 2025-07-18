import { ConsentManagerDialog, CookieBanner } from "@c15t/nextjs";

// Theme configuration object
const themeColors = {
  white: "#FFFFFF",
  black: "#000000",
  textLight: "#E2E2E2",
} as const;

// Derived theme values
const themeConfig = {
  bgColor: themeColors.white,
  bgColorDark: themeColors.black,
  primaryColor: themeColors.white,
  textColor: themeColors.textLight,
  get focusRing() {
    return `${this.primaryColor} !important`;
  },
  get focusShadow() {
    return `0 0 0 2px ${this.primaryColor}`;
  },
} as const;

export function ConsentBanner() {
  const { bgColor, bgColorDark, primaryColor, focusRing, focusShadow } = themeConfig;

  const mainButtonClassName =
    "relative flex items-center px-4 gap-2 text-sm font-semibold text-black group-hover:bg-white/90 duration-1000 rounded-lg bg-gradient-to-r from-white/80 to-white h-10 max-sm:flex-grow max-sm:justify-center";
  const secondaryButtonClassName =
    "items-center gap-2 px-4 duration-500 text-white/70 hover:text-white h-10 flex max-sm:flex-grow max-sm:justify-center";

  return (
    <>
      <CookieBanner
        theme={{
          "banner.footer.customize-button": {
            className: secondaryButtonClassName,
            noStyle: true,
          },
          "banner.footer.reject-button": {
            className: secondaryButtonClassName,
            noStyle: true,
          },
          "banner.footer.accept-button": {
            className: mainButtonClassName,
            noStyle: true,
          },
        }}
      />
      <ConsentManagerDialog
        theme={{
          "dialog.root": {
            style: {
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
          "widget.footer.accept-button": {
            className: secondaryButtonClassName,
            noStyle: true,
          },
          "widget.footer.reject-button": {
            className: secondaryButtonClassName,
            noStyle: true,
          },
          "widget.footer.save-button": {
            className: mainButtonClassName,
            noStyle: true,
          },
        }}
      />
    </>
  );
}
