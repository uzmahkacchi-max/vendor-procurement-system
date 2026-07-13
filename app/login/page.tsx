"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState("buyer");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");

  async function handleLogin() {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setLoading(false);
      alert("User not found.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    setLoading(false);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    if (profile.role === "buyer") {
      router.push("/dashboard");
    } else if (profile.role === "vendor") {
      router.push("/vendor");
    } else {
      alert("Invalid user role.");
    }
  }


  async function handleSignup() {
    if (!name || !company || !phone || !email || !password) {
      alert("Please fill all fields.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    const userId = data.user?.id;

    if (!userId) {
      setLoading(false);
      alert(
        "Signup successful. Please confirm your email before logging in."
      );
      return;
    }


    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        name: name.trim(),
        email: email.trim(),
        role: role,
        company: company.trim(),
        phone: phone.trim(),
      });


    setLoading(false);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    alert(
      "Account created! Please confirm your email before logging in."
    );

    setMode("login");
  }


  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white shadow-lg rounded-xl p-8 w-96">

        <h1 className="text-3xl font-bold text-center text-blue-600">
          {mode === "login" ? "Login" : "Sign Up"}
        </h1>


        {mode === "signup" && (
          <>
            <input
              className="w-full mt-6 border rounded-lg p-3"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />


            <select
              className="w-full mt-4 border rounded-lg p-3"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="buyer">
                Buyer
              </option>

              <option value="vendor">
                Vendor
              </option>

            </select>


            <input
              className="w-full mt-4 border rounded-lg p-3"
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />


            <input
              className="w-full mt-4 border rounded-lg p-3"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

          </>
        )}


        <input
          className="w-full mt-4 border rounded-lg p-3"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />


        <input
          className="w-full mt-4 border rounded-lg p-3"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />


        <button
          onClick={mode === "login" ? handleLogin : handleSignup}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg"
        >
          {loading
            ? "Loading..."
            : mode === "login"
            ? "Login"
            : "Create Account"}
        </button>


        <button
          className="w-full mt-4 text-blue-600"
          onClick={() =>
            setMode(mode === "login" ? "signup" : "login")
          }
        >
          {mode === "login"
            ? "Don't have an account? Sign up"
            : "Already have an account? Login"}
        </button>


        <a
          href="/"
          className="block text-center mt-4 text-blue-600"
        >
          Back to Home
        </a>

      </div>

    </main>
  );
}