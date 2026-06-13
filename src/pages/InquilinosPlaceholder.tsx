import { motion } from "framer-motion";

const InquilinosPlaceholder = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hero-bg px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Área Inquilino
        </h1>
        <p className="mt-3 text-muted-foreground text-lg">Próximamente</p>
      </motion.div>
    </div>
  );
};

export default InquilinosPlaceholder;
