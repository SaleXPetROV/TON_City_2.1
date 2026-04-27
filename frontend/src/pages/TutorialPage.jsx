import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap, ChevronRight, ChevronLeft, MapPin, Building2,
  Coins, Package, Link2, TrendingUp, CheckCircle2, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';

const STEP_ICONS = [GraduationCap, MapPin, Building2, Package, Link2, Coins, TrendingUp];
const STEP_COLORS = ['text-cyber-cyan', 'text-amber-400', 'text-purple-400', 'text-green-400', 'text-blue-400', 'text-yellow-400', 'text-red-400'];
const STEP_KEYS = [
  { title: 'welcomeTitle', content: 'welcomeContent', tip: 'welcomeTip' },
  { title: 'step1Title', content: 'step1Content', tip: 'step1Tip' },
  { title: 'step2Title', content: 'step2Content', tip: 'step2Tip' },
  { title: 'step3Title', content: 'step3Content', tip: 'step3Tip' },
  { title: 'step4Title', content: 'step4Content', tip: 'step4Tip' },
  { title: 'step5Title', content: 'step5Content', tip: 'step5Tip' },
  { title: 'step6Title', content: 'step6Content', tip: 'step6Tip' },
];

export default function TutorialPage({ user }) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const stepKeys = STEP_KEYS[currentStep];
  const Icon = STEP_ICONS[currentStep];
  const step = {
    title: t(stepKeys.title),
    icon: Icon,
    color: STEP_COLORS[currentStep],
    content: t(stepKeys.content),
    tip: t(stepKeys.tip),
  };

  return (
    <div className="flex h-screen bg-void">
      <Sidebar user={user} />
      
      <div className="flex-1 overflow-hidden lg:ml-16">
        <ScrollArea className="h-full">
          <div className="p-6 pt-4 max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 pl-8 lg:pl-0">
              <h1 className="font-unbounded text-2xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                <GraduationCap className="w-8 h-8 text-cyber-cyan" />
                ОБУЧЕНИЕ
              </h1>
              <p className="text-text-muted">Узнайте как играть в TON City Builder</p>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-8">
              {STEP_KEYS.map((_, idx) => (
                <div 
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex-1 h-2 rounded-full cursor-pointer transition-all ${
                    idx === currentStep ? 'bg-cyber-cyan' : idx < currentStep ? 'bg-cyber-cyan/50' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Step Content */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="glass-panel border-white/10 mb-6">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center ${step.color}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">{t('stepOf').replace('{current}', currentStep + 1).replace('{total}', STEP_KEYS.length)}</div>
                      <h2 className="text-xl font-bold text-white">{step.title}</h2>
                    </div>
                  </div>

                  <div className="text-text-muted whitespace-pre-line mb-6 leading-relaxed">
                    {step.content}
                  </div>

                  <div className="p-4 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-cyber-cyan flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-cyber-cyan mb-1 font-bold">СОВЕТ</div>
                      <div className="text-sm text-white">{step.tip}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                variant="outline"
                className="border-white/10"
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>

              {currentStep < STEP_KEYS.length - 1 ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="bg-cyber-cyan text-black"
                >
                  Далее
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/map')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Начать играть
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
