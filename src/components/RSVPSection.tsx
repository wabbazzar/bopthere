import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useCharacter } from '@/contexts/CharacterContext';
import { characterThemes } from '@/types/character';
import { useToast } from '@/hooks/use-toast';
import { RSVPService } from '@/integrations/aws/rsvp-service';
import { APIError } from '@/integrations/aws/api-client';
import { useOfflineRSVP } from '@/hooks/useOfflineRSVP';
import { ChevronLeft, Wifi, WifiOff } from 'lucide-react';

const characterContent = {
  wesley: {
    title: "Join our quest",
    description: "Will you answer the call to adventure? Your presence would make our quest complete! When you RSVP, your room will be reserved for you at Makoa Resorts for the entire weekend.",
    submitText: "Send RSVP",
    dietTitle: "Feast Preparations",
    dietDescription: "Every great quest requires proper nourishment! Let us know about any dietary restrictions so our chefs can prepare accordingly.",
    songTitle: "Battle Soundtrack",
    songDescription: "What epic song should accompany our celebration? Help us craft the perfect playlist for our victory dance!",
    messageTitle: "Words for the Heroes",
    messageDescription: "Share your wisdom or well wishes for the brave adventurers embarking on this new quest together!"
  },
  heather: {
    title: "Please join us",
    description: "Your presence would make our special day even more beautiful and meaningful. When you RSVP, your room will be reserved for you at Makoa Resorts for the entire weekend.",
    submitText: "Send RSVP",
    dietTitle: "Dining Preferences",
    dietDescription: "We want to ensure every detail is perfect! Please let us know about any dietary restrictions so we can accommodate your needs beautifully.",
    songTitle: "Musical Requests",
    songDescription: "Music fills our hearts with joy! Do you have a special song that would make our celebration even more magical?",
    messageTitle: "Sweet Messages",
    messageDescription: "We would love to hear your thoughts and well wishes as we begin this beautiful journey together!"
  },
  puffy: {
    title: "Are you coming?",
    description: "Please say yes! It won't be the same without you (and I need someone to share snacks with). When you RSVP, your room will be reserved for you at Makoa Resorts for the entire weekend.",
    submitText: "Send RSVP",
    dietTitle: "Snack Compatibility Check",
    dietDescription: "Important intel needed! Any food restrictions I should know about? I'm planning our snack strategy and need all the details.",
    songTitle: "Playlist Contributions",
    songDescription: "What should we add to the ultimate party playlist? I've been taking notes on everyone's favorites (don't ask how).",
    messageTitle: "Secret Messages",
    messageDescription: "Psst... got any special words for the happy couple? I promise to deliver them (after reading them first, obviously)."
  }
};

// Character-specific background images for each RSVP step
const characterBackgrounds = {
  wesley: {
    initial: '/app-uploads/wesley1.png',
    diet: '/app-uploads/wesley2.png',
    song: '/app-uploads/wesley3.png',
    message: '/app-uploads/wesley4.png'
  },
  heather: {
    initial: '/app-uploads/heather1.png',
    diet: '/app-uploads/heather2.png',
    song: '/app-uploads/heather3.png',
    message: '/app-uploads/heather4.png'
  },
  puffy: {
    initial: '/app-uploads/puffy1.png', // TODO: Add when image is provided
    diet: '/app-uploads/puffy2.png',
    song: '/app-uploads/puffy3.png',
    message: '/app-uploads/puffy4.png'
  }
};

type FormStep = 'initial' | 'diet' | 'song' | 'message' | 'complete';

export const RSVPSection: React.FC = () => {
  const { selectedCharacter } = useCharacter();
  const { toast } = useToast();
  const { submitRSVP, isOffline } = useOfflineRSVP();
  const [currentStep, setCurrentStep] = useState<FormStep>('initial');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    attendance: '',
    notifications: false,
    dietaryRestrictions: '',
    songRequest: '',
    messageForCouple: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preload all background images for the selected character to ensure smooth transitions
  useEffect(() => {
    if (!selectedCharacter) return;
    const characterImages = characterBackgrounds[selectedCharacter];
    if (characterImages) {
      Object.values(characterImages).forEach((imagePath) => {
        if (imagePath && !imagePath.includes('TODO')) {
          const img = new Image();
          img.src = imagePath;
        }
      });
    }
  }, [selectedCharacter]);

  if (!selectedCharacter) return null;

  const content = characterContent[selectedCharacter];
  const theme = characterThemes[selectedCharacter];
  
  // Get the background image for the current character and step
  const getBackgroundImage = () => {
    if (currentStep === 'complete') return null;
    return characterBackgrounds[selectedCharacter]?.[currentStep as keyof typeof characterBackgrounds[typeof selectedCharacter]];
  };

  const backgroundImage = getBackgroundImage();

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== INITIAL FORM SUBMISSION ===');
    
    if (!formData.name || !formData.email || !formData.attendance) {
      console.log('Validation failed - missing required fields');
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (formData.attendance === 'no') {
      // If not attending, submit immediately
      await submitCompleteForm();
    } else {
      // If attending, go to next step
      setCurrentStep('diet');
    }
  };

  const submitCompleteForm = async () => {
    console.log('=== FINAL FORM SUBMISSION ===');
    setIsSubmitting(true);
    
    try {
      // Convert form data to the format expected by useOfflineRSVP
      const rsvpData = {
        name: formData.name,
        email: formData.email,
        attending: formData.attendance === 'yes',
        dietaryRestrictions: formData.dietaryRestrictions || undefined,
        plusOne: false, // This form doesn't have plus one yet
        message: formData.messageForCouple || undefined
      };

      console.log('Data being submitted:', rsvpData);
      
      // Try offline-capable submission
      const result = await submitRSVP(rsvpData);

      if (result.success) {
        console.log('RSVP saved successfully:', result);
        
        const toastTitle = result.offline ? "RSVP saved offline!" : "RSVP received!";
        const toastDescription = result.offline 
          ? "Your RSVP has been saved locally and will be submitted when you're back online."
          : "Thank you for your response. We'll be in touch with more details soon!";

        toast({
          title: toastTitle,
          description: toastDescription,
          duration: 3000,
        });

        setCurrentStep('complete');
      } else {
        throw new Error('RSVP submission failed');
      }
    } catch (error) {
      console.error('Unexpected error during RSVP submission:', error);
      toast({
        title: "Error",
        description: "There was a problem saving your RSVP. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStepSubmit = (nextStep: FormStep) => {
    if (nextStep === 'complete') {
      submitCompleteForm();
    } else {
      setCurrentStep(nextStep);
    }
  };

  const goBack = () => {
    const stepOrder: FormStep[] = ['initial', 'diet', 'song', 'message'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const renderInitialForm = () => (
    <form onSubmit={handleInitialSubmit} className="space-y-6">
      <Input
        id="name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Name"
        required
        className="border-2"
        style={{ borderColor: theme.accent }}
      />

      <Input
        id="email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        placeholder="Email"
        required
        className="border-2"
        style={{ borderColor: theme.accent }}
      />

      <Input
        id="phone"
        type="tel"
        value={formData.phone}
        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
        placeholder="Phone"
        className="border-2"
        style={{ borderColor: theme.accent }}
      />

      <div className="space-y-4">
        <RadioGroup
          value={formData.attendance}
          onValueChange={(value) => setFormData(prev => ({ ...prev, attendance: value }))}
          required
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="yes" />
            <Label htmlFor="yes" className="font-body font-semibold text-gray-800 text-shadow-sm">Yes I'll be there!</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="no" />
            <Label htmlFor="no" className="font-body font-semibold text-gray-800 text-shadow-sm">Unfortunately, I can't make it</Label>
          </div>
        </RadioGroup>
      </div>

      <Button
        type="submit"
        className="w-full font-body text-lg py-6 hover:scale-105 transition-transform"
        style={{ backgroundColor: theme.primary }}
      >
        {content.submitText}
      </Button>
    </form>
  );

  const renderDietForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="diet" className="font-body font-semibold text-gray-800 text-base text-shadow-sm text-center block">Dietary Restrictions</Label>
        <Textarea
          id="diet"
          value={formData.dietaryRestrictions}
          onChange={(e) => setFormData(prev => ({ ...prev, dietaryRestrictions: e.target.value }))}
          placeholder={content.dietDescription}
          className="border-2 min-h-[100px]"
          style={{ borderColor: theme.accent }}
        />
      </div>
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => handleStepSubmit('song')}
          className="flex-1 font-body text-lg py-6 hover:scale-105 transition-transform"
          style={{ backgroundColor: theme.primary }}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderSongForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="song" className="font-body font-semibold text-gray-800 text-base text-shadow-sm text-center block">Song Request</Label>
        <Textarea
          id="song"
          value={formData.songRequest}
          onChange={(e) => setFormData(prev => ({ ...prev, songRequest: e.target.value }))}
          placeholder={content.songDescription}
          className="border-2 min-h-[100px]"
          style={{ borderColor: theme.accent }}
        />
      </div>
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => handleStepSubmit('message')}
          className="flex-1 font-body text-lg py-6 hover:scale-105 transition-transform"
          style={{ backgroundColor: theme.primary }}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderMessageForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="message" className="font-body font-semibold text-gray-800 text-base text-shadow-sm text-center block">Message for the Couple</Label>
        <Textarea
          id="message"
          value={formData.messageForCouple}
          onChange={(e) => setFormData(prev => ({ ...prev, messageForCouple: e.target.value }))}
          placeholder={content.messageDescription}
          className="border-2 min-h-[120px]"
          style={{ borderColor: theme.accent }}
        />
      </div>
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => handleStepSubmit('complete')}
          disabled={isSubmitting}
          className="flex-1 font-body text-lg py-6 hover:scale-105 transition-transform"
          style={{ backgroundColor: theme.primary }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit RSVP'}
        </Button>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="font-fantasy text-2xl font-bold" style={{ color: theme.primary }}>
        Thank you!
      </h3>
      <p className="font-body text-lg text-gray-600">
        Your RSVP has been received. We can't wait to celebrate with you!
      </p>
      <Button
        onClick={() => {
          setCurrentStep('initial');
          setFormData({
            name: '',
            email: '',
            phone: '',
            attendance: '',
            notifications: false,
            dietaryRestrictions: '',
            songRequest: '',
            messageForCouple: ''
          });
        }}
        variant="outline"
        className="font-body"
      >
        Submit Another RSVP
      </Button>
    </div>
  );

  const getStepContent = () => {
    switch (currentStep) {
      case 'initial':
        return { title: content.title, description: content.description, form: renderInitialForm() };
      case 'diet':
        return { title: content.dietTitle, description: content.dietDescription, form: renderDietForm() };
      case 'song':
        return { title: content.songTitle, description: content.songDescription, form: renderSongForm() };
      case 'message':
        return { title: content.messageTitle, description: content.messageDescription, form: renderMessageForm() };
      case 'complete':
        return { title: '', description: '', form: renderComplete() };
      default:
        return { title: content.title, description: content.description, form: renderInitialForm() };
    }
  };

  const stepContent = getStepContent();

  // Create background style for the Card (floating box)
  const cardStyle = backgroundImage ? {
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.6)), url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transition: 'all 0.6s ease-in-out',
    borderColor: theme.secondary
  } : {
    borderColor: theme.secondary,
    transition: 'all 0.6s ease-in-out'
  };

  // Determine if content should be positioned at bottom (for all form steps)
  const shouldPositionAtBottom = ['initial', 'diet', 'song', 'message'].includes(currentStep);
  const cardClassName = shouldPositionAtBottom 
    ? "border-2 shadow-xl w-full min-h-[80vh] md:min-h-[70vh] flex flex-col"
    : currentStep === 'complete'
    ? "border-2 shadow-xl w-full min-h-[80vh] md:min-h-[70vh] flex items-center justify-center"
    : "border-2 shadow-xl w-full min-h-[80vh] md:min-h-0";

  return (
    <section className="pt-10 md:pt-20 pb-20 px-6" style={{ background: `linear-gradient(135deg, ${theme.accent}10, ${theme.secondary}10)` }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Separate title card for initial step */}
        {currentStep === 'initial' && (
          <Card className="border-2 shadow-xl" style={{ borderColor: theme.secondary }}>
            <CardHeader className="text-center">
              <CardDescription className="font-body text-lg">
                {stepContent.description}
              </CardDescription>
              <p className="font-body text-sm text-gray-600 mt-4">
                *Note accommodations will be included as part of the venue (final price to be shared later, but aiming for &lt;$600/per person for 3 nights total)
              </p>
            </CardHeader>
          </Card>
        )}
        
        {/* Main RSVP form card */}
        <Card 
          key={`${selectedCharacter}-${currentStep}`}
          className={cardClassName}
          style={cardStyle}
        >
          {currentStep !== 'complete' && shouldPositionAtBottom && (
            <CardHeader className="text-center flex-shrink-0">
              <CardTitle className="font-fantasy text-4xl font-bold" style={{ color: theme.primary }}>
                {stepContent.title}
              </CardTitle>
              {isOffline && (
                <div className="flex items-center justify-center mt-2 text-sm text-yellow-600">
                  <WifiOff size={16} className="mr-1" />
                  <span>Offline - your RSVP will be saved locally</span>
                </div>
              )}
            </CardHeader>
          )}
          {currentStep !== 'complete' && !shouldPositionAtBottom && currentStep !== 'initial' && (
            <CardHeader className="text-center">
              <CardTitle className="font-fantasy text-4xl font-bold" style={{ color: theme.primary }}>
                {stepContent.title}
              </CardTitle>
              <CardDescription className="font-body text-lg">
                {stepContent.description}
              </CardDescription>
            </CardHeader>
          )}
          {shouldPositionAtBottom && <div className="flex-grow"></div>}
          <CardContent className={shouldPositionAtBottom ? "flex-shrink-0" : ""}>
            {stepContent.form}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
