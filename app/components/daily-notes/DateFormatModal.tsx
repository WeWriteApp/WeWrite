"use client";

import React, { useState, useContext, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { AuthContext } from '../../providers/AuthProvider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { useToast } from '../ui/use-toast';
import { format } from 'date-fns';

interface DateFormatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DateFormat = 'yyyy-MM-dd' | 'MM-dd-yyyy' | 'dd-MM-yyyy' | 'MMM dd, yyyy';

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; example: string }[] = [
  {
    value: 'yyyy-MM-dd',
    label: 'ISO Format (YYYY-MM-DD)',
    example: format(new Date(), 'yyyy-MM-dd')
  },
  {
    value: 'MM-dd-yyyy',
    label: 'US Format (MM-DD-YYYY)',
    example: format(new Date(), 'MM-dd-yyyy')
  },
  {
    value: 'dd-MM-yyyy',
    label: 'European Format (DD-MM-YYYY)',
    example: format(new Date(), 'dd-MM-yyyy')
  },
  {
    value: 'MMM dd, yyyy',
    label: 'Long Format (MMM DD, YYYY)',
    example: format(new Date(), 'MMM dd, yyyy')
  }
];

/**
 * DateFormatModal Component
 * 
 * Modal for changing global date format preference.
 * This affects how dates are displayed throughout WeWrite.
 */
export default function DateFormatModal({ open, onOpenChange }: DateFormatModalProps) {
  const { user } = useContext(AuthContext);
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<DateFormat>('yyyy-MM-dd');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user's current date format preference
  useEffect(() => {
    const loadDateFormatPreference = async () => {
      if (!user?.uid || !open) return;

      try {
        setLoading(true);
        const userPrefsRef = doc(db, 'userPreferences', user.uid);
        const userPrefsDoc = await getDoc(userPrefsRef);

        if (userPrefsDoc.exists()) {
          const prefs = userPrefsDoc.data();
          setSelectedFormat(prefs.dateFormat || 'yyyy-MM-dd');
        } else {
          setSelectedFormat('yyyy-MM-dd'); // Default format
        }
      } catch (error) {
        console.error('Error loading date format preference:', error);
        toast({
          title: 'Error',
          description: 'Failed to load date format preference',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadDateFormatPreference();
  }, [user?.uid, open, toast]);

  // Save date format preference
  const handleSave = async () => {
    if (!user?.uid) return;

    try {
      setSaving(true);
      const userPrefsRef = doc(db, 'userPreferences', user.uid);
      
      // Get existing preferences or create new ones
      const userPrefsDoc = await getDoc(userPrefsRef);
      const existingPrefs = userPrefsDoc.exists() ? userPrefsDoc.data() : {};

      // Update with new date format
      await setDoc(userPrefsRef, {
        ...existingPrefs,
        dateFormat: selectedFormat,
        updatedAt: new Date().toISOString()
      });

      toast({
        title: 'Success',
        description: 'Date format preference saved',
        variant: 'default'
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving date format preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to save date format preference',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Date Format Preference</DialogTitle>
          <DialogDescription>
            Choose how dates should be displayed throughout WeWrite. This affects daily note titles and all date displays.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <RadioGroup
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as DateFormat)}
              className="space-y-3"
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {option.example}
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
