import LoginForm from "@/components/form/LoginForm";

export async function generateMetadata() {
  return {
    title: "Login to WeWrite",
    description: "Login to your WeWrite account",
  };
}

const Login = () => {
  return (
    <div className="container mx-auto px-2 md:max-w-lg md:mt-10">
      <h1 className="text-2xl font-semibold mb-4 text-text">Login</h1>
      <LoginForm />
    </div>
  );
}


export default Login;