import { redirect } from "next/navigation";
import Link from "next/link";
import { getBrokerUser } from "@/lib/services/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function getClients(brokerId: string) {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select(`
      *,
      client_users(id),
      packages(id)
    `)
    .eq("broker_id", brokerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }

  return clients;
}

export default async function BrokerClientsPage() {
  const brokerUser = await getBrokerUser();

  if (!brokerUser) {
    redirect("/broker/login");
  }

  const clients = await getClients(brokerUser.broker_id);

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/broker/dashboard" className="text-sm text-blue-600 hover:underline mb-2 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h2 className="text-2xl font-bold text-gray-900">Clients</h2>
            <p className="text-gray-600">Manage your client list</p>
          </div>
          <Link href="/broker/clients/new">
            <Button>Add Client</Button>
          </Link>
        </div>

        {clients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-gray-500 mb-4">No clients yet</p>
              <Link href="/broker/clients/new">
                <Button>Add Your First Client</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const clientUsers = client.client_users as any[];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const packages = client.packages as any[];
              const hasAccount = clientUsers && clientUsers.length > 0;

              return (
                <Card key={client.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{client.full_name}</CardTitle>
                        <CardDescription>{client.email}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {hasAccount ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Pending Invite</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        {client.client_number && (
                          <span className="mr-4">Client #: {client.client_number}</span>
                        )}
                        <span>{packages?.length || 0} package(s)</span>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/broker/clients/${client.id}`}>
                          <Button variant="outline" size="sm">View Details</Button>
                        </Link>
                        {!hasAccount && (
                          <Link href={`/broker/clients/${client.id}/invite`}>
                            <Button variant="outline" size="sm">Send Invite</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
