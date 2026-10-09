export function NotConfigured() {
  return (
    <div className="card mx-auto mt-10 max-w-md space-y-2">
      <h1 className="text-lg font-semibold">Supabase not configured</h1>
      <p className="text-sm text-emerald-100/80">
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code>.env.local</code> (see <code>.env.local.example</code>) and restart the server.
      </p>
    </div>
  );
}
