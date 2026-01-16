"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBrowserClient } from "@supabase/ssr";

const completeRegistrationSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
});

type CompleteRegistrationInput = z.infer<typeof completeRegistrationSchema>;

export default function CompleteRegistrationPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_API!;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CompleteRegistrationInput>({
    resolver: zodResolver(completeRegistrationSchema),
  });

  useEffect(() => {
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/broker/register");
        return;
      }

      setUserEmail(user.email || null);

      // Pre-fill name from Google profile if available
      const name = user.user_metadata?.full_name || user.user_metadata?.name || "";
      setUserName(name);
      if (name) {
        setValue("fullName", name);
      }
    };

    checkUser();
  }, [router, setValue, supabaseUrl, supabaseAnonKey]);

  const onSubmit = async (data: CompleteRegistrationInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/broker/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Registration failed");
        return;
      }

      router.push("/broker/dashboard");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Complete Your Registration</CardTitle>
          <CardDescription className="text-center">
            {userEmail && `Signed in as ${userEmail}`}
            <br />
            Please provide your company details to continue
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Auckland Brokerage Ltd"
                {...register("companyName")}
                aria-invalid={errors.companyName ? "true" : "false"}
              />
              {errors.companyName && (
                <p className="text-sm text-destructive">{errors.companyName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Your Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                defaultValue={userName || ""}
                {...register("fullName")}
                aria-invalid={errors.fullName ? "true" : "false"}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? "Completing registration..." : "Complete Registration"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
