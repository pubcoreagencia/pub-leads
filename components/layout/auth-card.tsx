import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AuthField = {
  label: string;
  type: "email" | "password" | "text";
};

type AuthCardProps = {
  title: string;
  description: string;
  fields: AuthField[];
  primaryAction: string;
  secondaryHref: string;
  secondaryLabel: string;
};

export function AuthCard({
  title,
  description,
  fields,
  primaryAction,
  secondaryHref,
  secondaryLabel,
}: AuthCardProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white shadow-premium">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            {fields.map((field) => (
              <label className="grid gap-2 text-sm font-medium text-slate-700" key={field.label}>
                {field.label}
                <input
                  className="h-11 rounded-md border border-input bg-white px-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  placeholder={field.label}
                  type={field.type}
                />
              </label>
            ))}
            <Button className="w-full" disabled type="button">
              {primaryAction}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-slate-500">
            <Link className="font-medium text-red-700 hover:text-red-800" href={secondaryHref}>
              {secondaryLabel}
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
