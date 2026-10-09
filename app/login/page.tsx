import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <LoginForm initialError={typeof error === "string" ? error : null} />;
}
