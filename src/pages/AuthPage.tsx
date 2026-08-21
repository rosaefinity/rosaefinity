import { useState } from "react";
import { LoginPage } from "../components/auth/LoginPage";
import { RegisterPage } from "../components/auth/RegisterPage";
import { AnimatePresence, motion } from "framer-motion";

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <AnimatePresence mode="wait">
      <motion.div key={isLogin ? "login" : "register"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {isLogin ? (
          <LoginPage onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterPage onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
export default AuthPage;
