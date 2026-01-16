import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user is a broker
    const { data: brokerUser } = await supabase
      .from("broker_users")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (brokerUser) {
      redirect("/broker/dashboard");
    }

    // Check if user is a client
    const { data: clientUser } = await supabase
      .from("client_users")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (clientUser) {
      redirect("/client/dashboard");
    }

    // User exists but no broker/client record - redirect to complete registration
    redirect("/broker/complete-registration");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">InsuredIn</h1>
            <div className="flex gap-4">
              <Link href="/broker/login">
                <Button variant="outline">Broker Login</Button>
              </Link>
              <Link href="/client/login">
                <Button variant="outline">Client Login</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Insurance Broker Client Portal
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamline your insurance operations with AI-powered document processing
            and a modern client portal.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <CardTitle>Email BCC Processing</CardTitle>
              <CardDescription>
                Automatically extract and file documents from emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Simply BCC your documents inbox and let AI match documents to the right clients and policies.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Self-Service</CardTitle>
              <CardDescription>
                Give clients 24/7 access to their policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Clients can view policies, download documents, and submit requests anytime.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Broker Dashboard</CardTitle>
              <CardDescription>
                Manage everything from one place
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Review documents, manage clients, and track activity all in one dashboard.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="inline-block">
            <CardHeader>
              <CardTitle>Ready to get started?</CardTitle>
              <CardDescription>
                Create your broker account today
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4 justify-center">
              <Link href="/broker/register">
                <Button size="lg">Register as Broker</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            InsuredIn - AI-Powered Insurance Broker Portal
          </p>
        </div>
      </footer>
    </div>
  );
}
