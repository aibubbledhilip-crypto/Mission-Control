import { useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";

export default function Settings() {
  const { data: user } = useGetCurrentUser();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={user?.name || ""} disabled className="bg-black/50 border-border max-w-md" />
          </div>
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-black/50 border-border max-w-md" />
          </div>
          <div className="grid gap-2">
            <Label>Role</Label>
            <Input value={user?.role || ""} disabled className="bg-black/50 border-border max-w-md capitalize" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the console UI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              variant={theme === 'dark' ? 'default' : 'outline'} 
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'bg-primary text-primary-foreground' : 'border-border'}
            >
              Dark Mode (Default)
            </Button>
            <Button 
              variant={theme === 'light' ? 'default' : 'outline'} 
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'bg-primary text-primary-foreground' : 'border-border'}
            >
              Light Mode
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}