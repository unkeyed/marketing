import { CircleInfo, TriangleWarning2 } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { OptionalTag, RequiredTag } from "./form-textarea";

const selectTriggerVariants = cva(
  "flex min-h-9 w-full rounded-lg text-[13px] leading-5 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-gray-7 text-gray-12",
  {
    variants: {
      variant: {
        default: [
          "border border-gray-5 hover:border-gray-8 bg-gray-2",
          "focus:border focus:border-accent-12 focus:ring-4 focus:ring-gray-5 focus-visible:outline-none focus:ring-offset-0",
        ],
        success: [
          "border border-success-9 hover:border-success-10 bg-gray-2",
          "focus:border-success-8 focus:ring-2 focus:ring-success-2 focus-visible:outline-none",
        ],
        warning: [
          "border border-warning-9 hover:border-warning-10 bg-gray-2",
          "focus:border-warning-8 focus:ring-2 focus:ring-warning-2 focus-visible:outline-none",
        ],
        error: [
          "border border-error-9 hover:border-error-10 bg-gray-2",
          "focus:border-error-8 focus:ring-2 focus:ring-error-2 focus-visible:outline-none",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface SelectOption {
  value: string;
  label?: string;
}

export type FormSelectProps = {
  label?: string;
  description?: string | React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  options: string[] | SelectOption[];
  id?: string;
  name?: string;
  placeholder?: string;
  value: string;
  className?: string;
  variant?: "default" | "success" | "warning" | "error";
  onChange: (value: string) => void;
} & Omit<React.ComponentPropsWithoutRef<typeof SelectTrigger>, "onChange"> &
  VariantProps<typeof selectTriggerVariants>;

export const FormSelect = React.forwardRef<React.ElementRef<typeof SelectTrigger>, FormSelectProps>(
  (
    {
      label,
      description,
      error,
      required,
      id,
      className,
      optional,
      variant,
      options,
      placeholder = "Select an option",
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const inputVariant = error ? "error" : variant;
    const inputId = id || React.useId();
    const descriptionId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const isObjectOptions = options.length > 0 && typeof options[0] !== "string";

    return (
      <fieldset className={cn("flex flex-col gap-1.5 border-0 m-0 p-0", className)}>
        {label && (
          <label
            id={`${inputId}-label`}
            htmlFor={inputId}
            className="text-gray-11 text-[13px] flex items-center"
          >
            {label}
            {required && <RequiredTag hasError={!!error} />}
            {optional && <OptionalTag />}
          </label>
        )}
        <div
          className={cn(
            "relative flex items-center w-full",
            inputVariant === "error" ? "text-error-11" : "text-gray-11",
          )}
        >
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger
              ref={ref}
              id={inputId}
              className={cn(
                selectTriggerVariants({ variant: inputVariant }),
                "px-3 py-2 [&>span]:flex [&>span]:items-center",
              )}
              aria-describedby={error ? errorId : description ? descriptionId : undefined}
              aria-invalid={!!error}
              aria-required={required}
              {...props}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="dark bg-gray-2 ">
              <SelectGroup>
                {isObjectOptions
                  ? (options as SelectOption[]).map((option) => (
                      <SelectItem key={option.value} value={option.value} className="dark ">
                        {option.label || option.value}
                      </SelectItem>
                    ))
                  : (options as string[]).map((option) => (
                      <SelectItem key={option} value={option} className="dark hover:bg-gray-5">
                        {option}
                      </SelectItem>
                    ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {(description || error) && (
          <div className="text-[13px] leading-5">
            {error ? (
              <div id={errorId} role="alert" className="text-error-11 flex gap-2 items-center">
                <TriangleWarning2 className="flex-shrink-0" aria-hidden="true" />
                <span className="flex-1">{error}</span>
              </div>
            ) : description ? (
              <output
                id={descriptionId}
                className={cn(
                  "text-gray-9 flex gap-2 items-start",
                  variant === "success"
                    ? "text-success-11"
                    : variant === "warning"
                      ? "text-warning-11"
                      : "",
                )}
              >
                {variant === "warning" ? (
                  <TriangleWarning2
                    size="md-regular"
                    className="flex-shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleInfo
                    size="md-regular"
                    className="flex-shrink-0 mt-[3px]"
                    aria-hidden="true"
                  />
                )}
                <span className="flex-1">{description}</span>
              </output>
            ) : null}
          </div>
        )}
      </fieldset>
    );
  },
);

FormSelect.displayName = "FormSelect";
