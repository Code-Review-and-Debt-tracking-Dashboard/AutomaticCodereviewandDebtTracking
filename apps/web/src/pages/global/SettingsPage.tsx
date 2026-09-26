import { CircleHelp, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  NotificationIcon,
} from "../../components/icons";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  PageHeader,
  PageHeaderTitle,
  PageHeaderDescription,
} from "../../components/ui";

import { usePreference } from "../../lib/usePreference";


export function SettingsPage() {
  const [theme, setTheme] = usePreference<"dark" | "light">("theme", "dark");
  const [badge, setBadge] = usePreference<"on" | "off">("notificationBadge", "on");
  const [, setToursDone] = usePreference<string>("toursDone", "");
  const navigate = useNavigate();

  const replayTour = () => {
    setToursDone("");
    navigate("/dashboard");
  };

  const themeOptions = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <>

      {/* Header */}
      <PageHeader>
        <div>
          <PageHeaderTitle>Settings</PageHeaderTitle>
          <PageHeaderDescription>
            Saved in this browser only.
          </PageHeaderDescription>
        </div>
      </PageHeader>


      <div className="grid max-w-2xl gap-4">

        {/* Appearance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Moon size={16} className="text-primary" />
              <CardTitle>Appearance</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Switch between the light and dark dashboard.
                </p>
              </div>

              <div className="flex rounded-md border border-border p-0.5">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = theme === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTheme(option.id)}
                      className={`
                        flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs transition
                        ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}
                      `}
                    >
                      <Icon size={13} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <NotificationIcon size={16} className="text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show unread count</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The number next to the bell and in the sidebar.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={badge === "on"}
                aria-label="Show unread count"
                onClick={() => setBadge(badge === "on" ? "off" : "on")}
                className={`
                  relative h-5 w-9 shrink-0 rounded-full transition
                  ${badge === "on" ? "bg-primary" : "bg-muted-foreground/30"}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-card transition-transform
                    ${badge === "on" ? "translate-x-4" : ""}
                  `}
                />
              </button>
            </div>
          </CardContent>
        </Card>


        {/* Help */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CircleHelp size={16} className="text-primary" />
              <CardTitle>Help</CardTitle>
            </div>
          </CardHeader>

          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Tutorial</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Walk through the dashboard again.
                </p>
              </div>

              <button
                type="button"
                onClick={replayTour}
                className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:bg-accent"
              >
                Replay tutorial
              </button>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
