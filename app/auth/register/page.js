import RegisterForm from "../../components/RegisterForm";

export async function generateMetadata() {
  return {
    title: "Register to WeWrite",
    description: "Register to your WeWrite account",
  };
}

export default function RegisterPage() {
  return <RegisterForm />;
}