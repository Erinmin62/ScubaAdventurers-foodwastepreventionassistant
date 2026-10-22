import { useEffect, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { getGetGuardStateQueryKey, useUpdateBusinessProfile } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGuard } from '@/lib/guard';
import { businessTypes } from '@/lib/business-profile';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter a business name.').max(120, 'Use 120 characters or fewer.'),
  type: z.enum(['cafe', 'restaurant', 'food_vendor', 'cloud_kitchen', 'other']),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function BusinessProfilePage() {
  const { data, isLoading } = useGuard();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', type: 'other' },
  });

  useEffect(() => {
    if (data?.businessProfile) {
      form.reset(data.businessProfile);
    }
  }, [data?.businessProfile, form]);

  const saveProfile = useUpdateBusinessProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetGuardStateQueryKey(), updated);
        setMessage('Business profile saved.');
      },
      onError: () => setMessage('Could not save the profile. Check your connection and try again.'),
    },
  });

  function onSubmit(values: ProfileFormValues) {
    setMessage(null);
    saveProfile.mutate({ data: values });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Workspace settings</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Business profile</h1>
        <p className="mt-2 text-muted-foreground">Set the business name and type shown throughout your workspace.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>This profile is saved to your private owner workspace and appears in the shared workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={120} placeholder="e.g. Green Bowl Kitchen" data-testid="input-business-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-business-type" aria-label="Business type">
                          <SelectValue placeholder="Choose a business type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {businessTypes.map((option) => (
                          <SelectItem key={option.value} value={option.value} data-testid={`option-business-type-${option.value}`}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isLoading || saveProfile.isPending} data-testid="button-save-business-profile">
                  {saveProfile.isPending ? 'Saving…' : 'Save profile'}
                </Button>
                {message && <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p>}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-amber/40 bg-amber/5">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This workspace uses synthetic sample data. Business type identifies your profile only; planning rules and safety checks remain shared across food businesses.
        </CardContent>
      </Card>
    </div>
  );
}
