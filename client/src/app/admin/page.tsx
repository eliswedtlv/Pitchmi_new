"use client"

import { useState } from "react"
import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { adminLogin, getAdminLogs, getAdminAggregates, setServiceEnabled } from "@/lib/api"

type Tab = "logs" | "aggregates" | "service"

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("logs")

  // Logs state
  const [logs, setLogs] = useState<unknown[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState("")

  // Aggregates state
  const [aggs, setAggs] = useState<unknown[]>([])
  const [aggsLoading, setAggsLoading] = useState(false)

  // Service state
  const [serviceEnabled, setServiceEnabledState] = useState<boolean | null>(null)
  const [serviceLoading, setServiceLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    try {
      await adminLogin(password)
      setAuthed(true)
      loadLogs()
    } catch {
      setLoginError("Invalid password")
    }
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const data = await getAdminLogs({ action: actionFilter || undefined, limit: 100 })
      setLogs(data)
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadAggregates() {
    setAggsLoading(true)
    try {
      const data = await getAdminAggregates(30)
      setAggs(data)
    } finally {
      setAggsLoading(false)
    }
  }

  async function toggleService() {
    setServiceLoading(true)
    try {
      const next = !serviceEnabled
      await setServiceEnabled(next)
      setServiceEnabledState(next)
    } finally {
      setServiceLoading(false)
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <Brand className="mb-5" />
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-body text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                autoFocus
              />
              {loginError && <p className="text-meta text-bad-fg">{loginError}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-canvas px-4 pt-8 safe-b-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between border-b border-line pb-5">
          <div className="flex items-center gap-5">
            <Brand />
            <h1 className="text-title font-semibold text-fg">Admin</h1>
          </div>
          <Badge variant="success">Authenticated</Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-line pb-2">
          {(["logs", "aggregates", "service"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                if (t === "aggregates" && aggs.length === 0) loadAggregates()
              }}
              className={`rounded-control px-4 py-2 text-meta font-semibold capitalize transition-colors ${
                tab === t
                  ? "bg-accent text-accent-fg"
                  : "text-fg-muted hover:bg-raised hover:text-fg"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Logs tab */}
        {tab === "logs" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Filter by action (e.g. evaluate)"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-10 flex-1 rounded-control border border-line-strong bg-surface px-3 text-meta text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <Button onClick={loadLogs} disabled={logsLoading}>
                {logsLoading ? "Loading…" : "Refresh"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-panel border border-line bg-surface">
              <table className="w-full text-xs">
                <thead className="bg-raised text-fg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Time</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                    <th className="px-3 py-2 text-left font-medium">User</th>
                    <th className="px-3 py-2 text-left font-medium">Lang</th>
                    <th className="px-3 py-2 text-left font-medium">Latency</th>
                    <th className="px-3 py-2 text-left font-medium">Cost</th>
                    <th className="px-3 py-2 text-left font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs as Record<string, unknown>[]).map((row, i) => (
                    <tr key={i} className="border-t border-line hover:bg-raised/60">
                      <td className="px-3 py-2 text-fg-muted">
                        {new Date(row.ts as string).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-medium">{String(row.action ?? "")}</td>
                      <td className="px-3 py-2 text-fg-muted font-mono">
                        {String(row.user_id ?? "").slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2">{String(row.language ?? "")}</td>
                      <td className="px-3 py-2">{row.latency_ms ? `${row.latency_ms}ms` : ""}</td>
                      <td className="px-3 py-2">{row.cost_usd ? `$${Number(row.cost_usd).toFixed(4)}` : ""}</td>
                      <td className="px-3 py-2 text-bad-fg">{String(row.error ?? "")}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && !logsLoading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-fg-subtle">
                        No events found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aggregates tab */}
        {tab === "aggregates" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={loadAggregates} disabled={aggsLoading}>
                {aggsLoading ? "Loading…" : "Refresh"}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-panel border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-raised text-fg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Evals</th>
                    <th className="px-4 py-2 text-left font-medium">Users</th>
                    <th className="px-4 py-2 text-left font-medium">Avg Score</th>
                    <th className="px-4 py-2 text-left font-medium">Cost</th>
                    <th className="px-4 py-2 text-left font-medium">STT</th>
                    <th className="px-4 py-2 text-left font-medium">Eval</th>
                    <th className="px-4 py-2 text-left font-medium">Errors</th>
                    <th className="px-4 py-2 text-left font-medium">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {(aggs as Record<string, unknown>[]).map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-4 py-2">{String(row.day ?? "")}</td>
                      <td className="px-4 py-2">{String(row.evals ?? 0)}</td>
                      <td className="px-4 py-2">{String(row.unique_users ?? 0)}</td>
                      <td className="px-4 py-2">{row.avg_score ? Number(row.avg_score).toFixed(1) : ""}</td>
                      {/* 4dp, not 2: a real day costs single-cent money, and
                          toFixed(2) rendered every split as $0.00. Rows written
                          before T-1172 have no cost breakdown and legitimately
                          report $0.0000 for the split (never NaN). */}
                      <td className="px-4 py-2">${Number(row.total_cost_usd ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-2">${Number(row.total_stt_usd ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-2">${Number(row.total_eval_usd ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-2 text-bad-fg">{String(row.errors ?? 0)}</td>
                      <td className="px-4 py-2">{row.avg_latency_ms ? `${Math.round(Number(row.avg_latency_ms))}ms` : ""}</td>
                    </tr>
                  ))}
                  {aggs.length === 0 && !aggsLoading && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-fg-subtle">No data.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Service tab */}
        {tab === "service" && (
          <div className="max-w-sm space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Kill Switch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-meta text-fg-muted">Service status</span>
                  <Badge variant={serviceEnabled === false ? "destructive" : "success"}>
                    {serviceEnabled === false ? "PAUSED" : "ACTIVE"}
                  </Badge>
                </div>
                <Button
                  onClick={toggleService}
                  disabled={serviceLoading}
                  variant={serviceEnabled === false ? "success" : "destructive"}
                  className="w-full"
                >
                  {serviceLoading
                    ? "Updating…"
                    : serviceEnabled === false
                    ? "Re-enable service"
                    : "Pause service"}
                </Button>
                <p className="text-micro text-fg-subtle">
                  Pausing will return 503 to all non-admin API calls.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
