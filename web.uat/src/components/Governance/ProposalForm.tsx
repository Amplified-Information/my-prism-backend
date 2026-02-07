import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { AlertCircle, Check, FileText, Calendar, DollarSign, Eye, Plus, X, Upload, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGovernance } from "@/hooks/useGovernance";
import { useWallet } from "@/contexts/WalletContext";
import { useTranslation } from "react-i18next";
import { addDays, isBefore, isAfter } from "date-fns";
import type { CreateProposalData } from "@/types/governance";

const ProposalForm = () => {
  const { t } = useTranslation();

  const STEPS = [
    { title: t('marketFactory.steps.marketDetails'), icon: FileText },
    { title: t('marketFactory.steps.resolutionParams'), icon: Calendar },
    { title: t('marketFactory.steps.economicParams'), icon: DollarSign },
    { title: t('marketFactory.steps.reviewSubmit'), icon: Eye },
  ];

  const { 
    createProposal, 
    isCreatingProposal, 
    canCreateProposal, 
    getVotingPowerRequirement,
    userBalance 
  } = useGovernance();
  const { wallet } = useWallet();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateProposalData>({
    title: '',
    description: '',
    market_title: '',
    market_description: '',
    market_outcomes: { yes: 'Yes', no: 'No' },
    proposal_end_date: addDays(new Date(), 1).toISOString().slice(0, 19),
    resolution_date: new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 19),
    oracle_type: 'manual',
    oracle_config: {},
    initial_liquidity: 1000,
    collateral_type: 'HBAR',
  });

  const [marketType, setMarketType] = useState<'binary' | 'multiple-choice'>('binary');
  const [marketImage, setMarketImage] = useState<File | null>(null);
  const [outcomeImages, setOutcomeImages] = useState<{[key: string]: File | null}>({});
  const [multiChoiceOutcomes, setMultiChoiceOutcomes] = useState<string[]>(['Option A', 'Option B', 'Option C']);

  const updateFormData = (updates: Partial<CreateProposalData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    createProposal({ ...formData, marketImage });
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.title && formData.description && formData.market_title && formData.market_description && formData.proposal_end_date && marketType;
      case 2:
        return formData.resolution_date && formData.oracle_type;
      case 3:
        return formData.initial_liquidity > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleImageUpload = (file: File, type: 'market' | 'outcome', outcomeKey?: string) => {
    if (type === 'market') {
      setMarketImage(file);
    } else if (type === 'outcome' && outcomeKey) {
      setOutcomeImages(prev => ({ ...prev, [outcomeKey]: file }));
    }
  };

  const addOutcome = () => {
    setMultiChoiceOutcomes(prev => [...prev, `Option ${prev.length + 1}`]);
  };

  const removeOutcome = (index: number) => {
    if (multiChoiceOutcomes.length > 2) {
      setMultiChoiceOutcomes(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateOutcome = (index: number, value: string) => {
    setMultiChoiceOutcomes(prev => prev.map((outcome, i) => i === index ? value : outcome));
  };

  if (!wallet.isConnected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('marketFactory.alerts.connectWallet')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!canCreateProposal()) {
    const required = getVotingPowerRequirement();
    const current = userBalance?.total_voting_power || 0;
    
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('marketFactory.alerts.votingPowerRequired', { 
                required: required.toLocaleString(), 
                current: current.toLocaleString() 
              })}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            {STEPS.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === index + 1 
                    ? 'bg-primary text-primary-foreground' 
                    : currentStep > index + 1 
                      ? 'bg-green-500 text-white' 
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {currentStep > index + 1 ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 ${
                    currentStep > index + 1 ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h3>
          </div>
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="title">{t('marketFactory.form.proposalTitle')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateFormData({ title: e.target.value })}
                  placeholder={t('marketFactory.form.proposalTitlePlaceholder')}
                />
              </div>
              
              <div>
                <Label htmlFor="description">{t('marketFactory.form.proposalDescription')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder={t('marketFactory.form.proposalDescriptionPlaceholder')}
                  rows={4}
                />
              </div>

              <div>
                <Label>{t('marketFactory.form.marketType')}</Label>
                <Select value={marketType} onValueChange={(value: 'binary' | 'multiple-choice') => setMarketType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('marketFactory.form.selectMarketType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="binary">{t('marketFactory.form.binaryMarket')}</SelectItem>
                    <SelectItem value="multiple-choice">{t('marketFactory.form.multipleChoice')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="market_title">{t('marketFactory.form.marketQuestion')}</Label>
                <Input
                  id="market_title"
                  value={formData.market_title}
                  onChange={(e) => updateFormData({ market_title: e.target.value })}
                  placeholder={t('marketFactory.form.marketQuestionPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="market_description">{t('marketFactory.form.marketDescription')}</Label>
                <Textarea
                  id="market_description"
                  value={formData.market_description}
                  onChange={(e) => updateFormData({ market_description: e.target.value })}
                  placeholder={t('marketFactory.form.marketDescriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div>
                <Label>{t('marketFactory.form.proposalVotingEndDate')}</Label>
                <div className="mt-1">
                  <DatePicker
                    date={formData.proposal_end_date ? new Date(formData.proposal_end_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateFormData({ proposal_end_date: date.toISOString().split('T')[0] + 'T23:59:59' });
                      }
                    }}
                    placeholder={t('marketFactory.form.selectProposalEndDate')}
                    disabled={(date) => {
                      const today = new Date();
                      const fourteenDaysFromNow = new Date();
                      fourteenDaysFromNow.setDate(today.getDate() + 14);
                      return date <= today || date > fourteenDaysFromNow;
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('marketFactory.form.proposalVotingDateHint')}
                </p>
              </div>

              <div>
                <Label>{t('marketFactory.form.marketImage')}</Label>
                <div className="mt-2">
                  <Label htmlFor="market_image_upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/50 transition-colors">
                      <div className="flex flex-col items-center space-y-2">
                        <Image className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {marketImage ? marketImage.name : t('marketFactory.form.uploadMarketImage')}
                        </span>
                      </div>
                    </div>
                  </Label>
                  <input
                    id="market_image_upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'market');
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>{t('marketFactory.form.marketOutcomes')}</Label>
                {marketType === 'binary' ? (
                  <div className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>{t('marketFactory.form.yesOutcome')}</Label>
                        <div className="p-3 bg-muted rounded-md">
                          <span className="text-sm font-medium">{t('common.yes')}</span>
                        </div>
                      </div>
                      <div>
                        <Label>{t('marketFactory.form.noOutcome')}</Label>
                        <div className="p-3 bg-muted rounded-md">
                          <span className="text-sm font-medium">{t('common.no')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mt-2">
                    {multiChoiceOutcomes.map((outcome, index) => (
                      <div key={index} className="flex items-end space-x-3">
                        <div className="flex-1">
                          <Label htmlFor={`outcome_${index}`}>{t('marketFactory.form.outcome')} {index + 1}</Label>
                          <Input
                            id={`outcome_${index}`}
                            value={outcome}
                            onChange={(e) => updateOutcome(index, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          />
                          <div className="mt-2">
                            <Label htmlFor={`outcome_image_${index}`} className="cursor-pointer">
                              <div className="border border-muted rounded p-2 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center space-x-2">
                                  <Upload className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {outcomeImages[`outcome_${index}`] ? outcomeImages[`outcome_${index}`]?.name : t('marketFactory.form.uploadImage')}
                                  </span>
                                </div>
                              </div>
                            </Label>
                            <input
                              id={`outcome_image_${index}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, 'outcome', `outcome_${index}`);
                              }}
                            />
                          </div>
                        </div>
                        {multiChoiceOutcomes.length > 2 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeOutcome(index)}
                            className="mb-8"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addOutcome}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('marketFactory.form.addOutcome')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="resolution_date">{t('marketFactory.form.resolutionDate')}</Label>
                <DatePicker
                  date={formData.resolution_date ? new Date(formData.resolution_date) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      updateFormData({ resolution_date: date.toISOString().split('T')[0] + 'T23:59:59' });
                    }
                  }}
                  placeholder={t('marketFactory.form.selectResolutionDate')}
                  disabled={(date) => {
                    const today = new Date();
                    const fourteenDaysFromNow = new Date();
                    fourteenDaysFromNow.setDate(today.getDate() + 14);
                    return date <= today || date > fourteenDaysFromNow;
                  }}
                />
              </div>

              <div>
                <Label htmlFor="oracle_type">{t('marketFactory.form.oracleType')}</Label>
                <Select
                  value={formData.oracle_type}
                  onValueChange={(value) => updateFormData({ oracle_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('marketFactory.form.selectOracleType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('marketFactory.form.manualResolution')}</SelectItem>
                    <SelectItem value="api_endpoint">{t('marketFactory.form.apiOracle')}</SelectItem>
                    <SelectItem value="consensus">{t('marketFactory.form.consensusOracle')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.oracle_type === 'api_endpoint' && (
                <div>
                  <Label htmlFor="api_endpoint">{t('marketFactory.form.apiEndpoint')}</Label>
                  <Input
                    id="api_endpoint"
                    value={formData.oracle_config?.api_endpoint || ''}
                    onChange={(e) => updateFormData({ 
                      oracle_config: { 
                        ...formData.oracle_config, 
                        api_endpoint: e.target.value 
                      }
                    })}
                    placeholder="https://api.example.com/data"
                  />
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="initial_liquidity">{t('marketFactory.form.initialLiquidity')}</Label>
                <Input
                  id="initial_liquidity"
                  type="number"
                  value={formData.initial_liquidity}
                  onChange={(e) => updateFormData({ initial_liquidity: parseFloat(e.target.value) || 0 })}
                  placeholder="1000"
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <Label htmlFor="collateral_type">{t('marketFactory.form.collateralType')}</Label>
                <Select
                  value={formData.collateral_type}
                  onValueChange={(value) => updateFormData({ collateral_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('marketFactory.form.selectCollateralType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HBAR">HBAR</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">{t('marketFactory.review.title')}</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{t('marketFactory.review.proposalDetails')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{t('marketFactory.review.titleLabel')}</strong> {formData.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{t('marketFactory.review.descriptionLabel')}</strong> {formData.description}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">{t('marketFactory.review.marketConfig')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{t('marketFactory.review.questionLabel')}</strong> {formData.market_title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{t('marketFactory.review.descriptionLabel')}</strong> {formData.market_description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{t('marketFactory.review.outcomesLabel')}</strong> {formData.market_outcomes.yes} / {formData.market_outcomes.no}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">{t('marketFactory.review.resolutionParams')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{t('marketFactory.review.resolutionDateLabel')}</strong> {new Date(formData.resolution_date).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{t('marketFactory.review.oracleTypeLabel')}</strong> {formData.oracle_type}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">{t('marketFactory.review.economicParams')}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{t('marketFactory.review.initialLiquidityLabel')}</strong> {formData.initial_liquidity} {formData.collateral_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{t('marketFactory.review.collateralTypeLabel')}</strong> {formData.collateral_type}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              {t('marketFactory.form.previous')}
            </Button>

            {currentStep < 4 ? (
              <Button 
                onClick={nextStep}
                disabled={!isStepValid(currentStep)}
              >
                {t('marketFactory.form.next')}
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isCreatingProposal || !isStepValid(currentStep)}
              >
                {isCreatingProposal ? t('marketFactory.form.creating') : t('marketFactory.form.createProposal')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProposalForm;
