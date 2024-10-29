import RegisterForm from "@/components/form/RegisterForm";

export async function generateMetadata() {
  return {
    title: "Register to WeWrite",
    description: "Register to your WeWrite account",
  };
}

const Register = () => {
  return (
    <div className="container mx-auto md:max-w-lg md:mt-10">
      <h1 className="text-2xl font-semibold mb-4">Register</h1>
      <RegisterForm />
    </div>
  );
}


export default Register;