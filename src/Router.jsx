import { lazy, Suspense, useEffect, useState } from "react"
import App from "./App"

const Admin = lazy(() => import("./components/Admin"))
const isAdminRoute = () => window.location.hash.startsWith("#/admin") ||
  new URLSearchParams(window.location.search).get("admin") === "1"

export default function Router() {
  const [admin, setAdmin] = useState(isAdminRoute)
  useEffect(() => {
    const navigate = () => setAdmin(isAdminRoute())
    window.addEventListener("hashchange", navigate)
    return () => window.removeEventListener("hashchange", navigate)
  }, [])
  return admin ? <Suspense fallback={<p className="p-8 text-white">Cargando administración…</p>}><Admin /></Suspense> : <App />
}
