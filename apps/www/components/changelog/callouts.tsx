import type { ReactNode } from "react";

type CalloutProps = {
  children: ReactNode;
  title?: string;
};

const variants = {
  info: {
    border: "border-l-[#3DC5FA]",
    bg: "bg-[#3DC5FA]/10",
    titleColor: "text-[#3DC5FA]",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
        <path d="M16.5 16.5V19.5" stroke="#3DC5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 14.25C16.9142 14.25 17.25 13.9142 17.25 13.5C17.25 13.0858 16.9142 12.75 16.5 12.75C16.0858 12.75 15.75 13.0858 15.75 13.5C15.75 13.9142 16.0858 14.25 16.5 14.25Z" fill="#3DC5FA" />
        <path d="M16.5 24.5C20.9183 24.5 24.5 20.9183 24.5 16.5C24.5 12.0817 20.9183 8.5 16.5 8.5C12.0817 8.5 8.5 12.0817 8.5 16.5C8.5 20.9183 12.0817 24.5 16.5 24.5Z" stroke="#3DC5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  success: {
    border: "border-l-[#3CEEAE]",
    bg: "bg-[#3CEEAE]/10",
    titleColor: "text-[#3CEEAE]",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
        <path d="M13.5 16.5L15.5 18.5L19.5 14.5" stroke="#3CEEAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 24.5C20.9183 24.5 24.5 20.9183 24.5 16.5C24.5 12.0817 20.9183 8.5 16.5 8.5C12.0817 8.5 8.5 12.0817 8.5 16.5C8.5 20.9183 12.0817 24.5 16.5 24.5Z" stroke="#3CEEAE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  warning: {
    border: "border-l-[#FFD55D]",
    bg: "bg-[#FFD55D]/10",
    titleColor: "text-[#FFD55D]",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
        <path d="M16.5 13.5V16.5" stroke="#FFD55D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 20.25C16.9142 20.25 17.25 19.9142 17.25 19.5C17.25 19.0858 16.9142 18.75 16.5 18.75C16.0858 18.75 15.75 19.0858 15.75 19.5C15.75 19.9142 16.0858 20.25 16.5 20.25Z" fill="#FFD55D" />
        <path d="M25.2918 21.1356L17.9961 8.36824C17.6893 7.83134 17.1184 7.5 16.5 7.5C15.8816 7.5 15.3107 7.83134 15.0039 8.36824L7.70822 21.1356C7.57177 21.3744 7.5 21.6447 7.5 21.9197C7.5 22.7925 8.20753 23.5 9.08032 23.5H23.9197C24.7925 23.5 25.5 22.7925 25.5 21.9197C25.5 21.6447 25.4282 21.3744 25.2918 21.1356Z" stroke="#FFD55D" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    border: "border-l-[#FB1048]",
    bg: "bg-[#FB1048]/10",
    titleColor: "text-[#FB1048]",
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
        <path d="M16.5 12.5V15.5" stroke="#FB1048" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 19.25C16.9142 19.25 17.25 18.9142 17.25 18.5C17.25 18.0858 16.9142 17.75 16.5 17.75C16.0858 17.75 15.75 18.0858 15.75 18.5C15.75 18.9142 16.0858 19.25 16.5 19.25Z" fill="#FB1048" />
        <path d="M24.8251 14.8251L18.2071 8.20711C17.7544 7.75435 17.1403 7.5 16.5 7.5C15.8597 7.5 15.2456 7.75435 14.7929 8.20711L8.17488 14.8251C7.74276 15.2572 7.5 15.8433 7.5 16.4544C7.5 17.1189 7.78683 17.751 8.28687 18.1885L14.7474 23.8415C15.2326 24.266 15.8553 24.5 16.5 24.5C17.1447 24.5 17.7674 24.266 18.2526 23.8415L24.7131 18.1885C25.2132 17.751 25.5 17.1189 25.5 16.4544C25.5 15.8433 25.2572 15.2572 24.8251 14.8251Z" stroke="#FB1048" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
} as const;

type VariantKey = keyof typeof variants;

function Callout({
  children,
  title,
  variant,
}: CalloutProps & { variant: VariantKey }) {
  const v = variants[variant];
  return (
    <div
      className={`flex gap-3 border-l-4 ${v.border} ${v.bg} rounded-r-md px-4 py-3 my-4
        [&_p]:!text-sm [&_p]:!leading-6 [&_p]:!text-white/80 [&_p]:!m-0`}
    >
      <span className="mt-[3px]">{v.icon}</span>
      <div className="min-w-0">
        {title && (
          <p className={`!font-semibold !text-sm !mb-1 ${v.titleColor}`}>{title}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export const Note = ({ children, title }: CalloutProps) => (
  <Callout variant="info" title={title}>{children}</Callout>
);

export const Info = ({ children, title }: CalloutProps) => (
  <Callout variant="info" title={title}>{children}</Callout>
);

export const Tip = ({ children, title }: CalloutProps) => (
  <Callout variant="success" title={title}>{children}</Callout>
);

export const Check = ({ children, title }: CalloutProps) => (
  <Callout variant="success" title={title}>{children}</Callout>
);

export const Warning = ({ children, title }: CalloutProps) => (
  <Callout variant="warning" title={title}>{children}</Callout>
);

export const Danger = ({ children, title }: CalloutProps) => (
  <Callout variant="error" title={title}>{children}</Callout>
);
