import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Layout/Header";
import ProposalForm from "@/components/Governance/ProposalForm";
import GovernanceDashboard from "@/components/Governance/GovernanceDashboard";
import { useTranslation } from "react-i18next";

const CreateMarket = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('marketFactory.title')}</h1>
          <p className="text-muted-foreground">{t('marketFactory.description')}</p>
        </div>
        
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">{t('marketFactory.tabs.create')}</TabsTrigger>
            <TabsTrigger value="governance">{t('marketFactory.tabs.governance')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="create">
            <ProposalForm />
          </TabsContent>
          
          <TabsContent value="governance">
            <GovernanceDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CreateMarket;
