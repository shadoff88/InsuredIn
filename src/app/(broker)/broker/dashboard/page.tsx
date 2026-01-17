import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrokerUser } from "@/lib/services/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function BrokerDashboardPage() {
  console.log('[Dashboard] Loading broker dashboard...');
  const brokerUser = await getBrokerUser();
  console.log('[Dashboard] getBrokerUser result:', {
    found: !!brokerUser,
    brokerUserId: brokerUser?.id,
    willRedirect: !brokerUser,
  });

  if (!brokerUser) {
    console.log('[Dashboard] No broker user, redirecting to /broker/login');
    redirect("/broker/login");
  }

  console.log('[Dashboard] Broker user found, rendering dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">InsuredIn</h1>
              <p className="text-sm text-gray-500">{brokerUser.brokers.company_name}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {brokerUser.full_name}
              </span>
              <form action="/api/auth/logout" method="POST">
                <Button variant="outline" size="sm" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600">Welcome to your broker portal</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Reviews</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Documents awaiting review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Clients</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Active clients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Documents This Week</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Processed via email BCC
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Client Logins</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                This week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Inbox</CardTitle>
              <CardDescription>
                Review documents sent via BCC
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/broker/email-inbox">
                <Button className="w-full">View Inbox</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clients</CardTitle>
              <CardDescription>
                Manage your client list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/broker/clients">
                <Button variant="outline" className="w-full">View Clients</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
              <CardDescription>
                Configure branding and integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/broker/settings">
                <Button variant="outline" className="w-full">Open Settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
