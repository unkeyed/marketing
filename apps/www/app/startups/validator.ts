import { formOptions } from "@tanstack/react-form/nextjs";

export const formOpts = formOptions({
  defaultValues: {
    "Full Name": "",
    Email: "",
    "Working With": "",
    "Workspace ID": "",
    "Migrating From": "",
    "More Info": "",
  },
});

export const vcAcceleratorOptions = [
  "Essence",
  "Uncork",
  "Sunflower Capital",
  "Techstars",
  "YC",
  "Other",
];
