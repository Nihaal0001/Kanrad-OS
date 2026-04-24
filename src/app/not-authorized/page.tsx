export default function NotAuthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3 p-8">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access this area.</p>
        <a
          href="/auth/login"
          className="inline-block mt-4 text-sm underline text-muted-foreground"
        >
          Back to login
        </a>
      </div>
    </div>
  )
}
