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
  "Arc",
  "Essence",
  "Seedcamp",
  "Preston Warner",
  "Sunflower Capital",
  "Techstars",
  "Uncork",
  "YC",
  "Other",
];
