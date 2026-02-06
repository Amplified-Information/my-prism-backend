import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

interface CategoryTabsProps {
  categories: Array<{
    id: string;
    name: string;
    icon: any;
  }>;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

const getCategoryTranslationKey = (categoryName: string): string => {
  const keyMap: { [key: string]: string } = {
    'All': 'rewards.categoryAll',
    'Favourite': 'rewards.categoryFavourite',
    'Politics': 'categories.politics',
    'Sports': 'categories.sports',
    'Culture': 'categories.culture',
    'Crypto': 'categories.crypto',
    'Climate': 'categories.climate',
    'Economics': 'categories.economics',
    'Mentions': 'categories.mentions',
    'Companies': 'categories.companies',
    'Financials': 'categories.financials',
    'Tech & Science': 'categories.techScience',
    'Health': 'categories.health',
    'World': 'categories.world'
  };
  return keyMap[categoryName] || categoryName;
};

const CategoryTabs = ({ categories, selectedCategory, onSelectCategory }: CategoryTabsProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 overflow-x-auto">
      <Tabs value={selectedCategory} onValueChange={onSelectCategory}>
        <TabsList className="inline-flex h-auto p-1 bg-card/50 border border-border/40">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className={`px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md transition-all ${
                  category.id === 'favourite' ? 'data-[state=active]:bg-yellow-500 data-[state=active]:text-white' : ''
                }`}
              >
                <Icon className={`mr-2 h-4 w-4 ${category.id === 'favourite' && category.id === category.id ? 'text-yellow-500' : ''}`} />
                {t(getCategoryTranslationKey(category.name))}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
};

export default CategoryTabs;
