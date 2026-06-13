import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ModulesGrid from "@/components/ModulesGrid";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <ModulesGrid />
      <Footer />
    </div>
  );
};

export default Index;
