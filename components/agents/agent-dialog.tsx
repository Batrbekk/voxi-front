"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Agent } from "@/types";
import { useAgentStore } from "@/store/agent";
import { toast } from "sonner";
import { Volume2, Loader2 } from "lucide-react";
import api from "@/lib/api";

const agentSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  voiceName: z.string().default("ru-RU-Wavenet-A"),
  speakingRate: z.number().min(0.5).max(2).default(1.0),
  pitch: z.number().min(-20).max(20).default(0),
  model: z.string().default("gemini-1.5-pro"),
  systemPrompt: z.string().min(1, "Системный промпт обязателен"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(100).max(8000).default(2000),
});

type AgentFormData = z.infer<typeof agentSchema>;

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null;
}

export function AgentDialog({ open, onOpenChange, agent }: AgentDialogProps) {
  const { createAgent, updateAgent } = useAgentStore();
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const form = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: "",
      description: "",
      voiceName: "ru-RU-Wavenet-A",
      speakingRate: 1.0,
      pitch: 0,
      model: "gemini-1.5-pro",
      systemPrompt: "",
      temperature: 0.7,
      maxTokens: 2000,
    },
  });

  useEffect(() => {
    if (agent) {
      form.reset({
        name: agent.name,
        description: agent.description || "",
        voiceName: agent.voiceSettings.voiceName || "ru-RU-Wavenet-A",
        speakingRate: agent.voiceSettings.speakingRate || 1.0,
        pitch: agent.voiceSettings.pitch || 0,
        model: agent.aiSettings.model,
        systemPrompt: agent.aiSettings.systemPrompt,
        temperature: agent.aiSettings.temperature || 0.7,
        maxTokens: agent.aiSettings.maxTokens || 2000,
      });
    } else {
      form.reset();
    }
  }, [agent, form]);

  const handlePreviewVoice = async () => {
    try {
      setIsPlayingVoice(true);

      const voiceName = form.getValues("voiceName");
      const speakingRate = form.getValues("speakingRate");
      const pitch = form.getValues("pitch");

      const response = await api.post("/agents/preview-voice", {
        voiceName,
        speakingRate,
        pitch,
      });

      // Convert base64 to audio and play
      const { audio } = response.data;
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))],
        { type: "audio/wav" }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioUrl);

      audioElement.onended = () => {
        setIsPlayingVoice(false);
        URL.revokeObjectURL(audioUrl);
      };

      audioElement.onerror = () => {
        setIsPlayingVoice(false);
        URL.revokeObjectURL(audioUrl);
        toast.error("Ошибка воспроизведения аудио");
      };

      await audioElement.play();
    } catch (error) {
      setIsPlayingVoice(false);
      toast.error("Не удалось прослушать голос");
      console.error(error);
    }
  };

  const onSubmit = async (data: AgentFormData) => {
    try {
      // Определяем пол на основе голоса
      const getGenderFromVoice = (voiceName: string): string => {
        if (voiceName === "ru-RU-Wavenet-A" || voiceName === "ru-RU-Wavenet-C") {
          return "female";
        }
        return "male";
      };

      const agentData = {
        name: data.name,
        description: data.description,
        voiceSettings: {
          voiceName: data.voiceName,
          language: "ru-RU",
          gender: getGenderFromVoice(data.voiceName),
          speakingRate: data.speakingRate,
          pitch: data.pitch,
          volumeGainDb: 0,
        },
        aiSettings: {
          model: data.model,
          systemPrompt: data.systemPrompt,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          integratedWithAi: true,
        },
      };

      if (agent) {
        await updateAgent(agent._id, agentData);
        toast.success("Агент обновлен");
      } else {
        await createAgent(agentData);
        toast.success("Агент создан");
      }

      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error("Ошибка при сохранении агента");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {agent ? "Редактировать агента" : "Создать агента"}
          </DialogTitle>
          <DialogDescription>
            Настройте параметры голосового AI ассистента
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название агента" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Описание агента"
                      {...field}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Настройки голоса</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewVoice}
                  disabled={isPlayingVoice}
                  className="gap-2"
                >
                  {isPlayingVoice ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Воспроизведение...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      Прослушать
                    </>
                  )}
                </Button>
              </div>

              <FormField
                control={form.control}
                name="voiceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Голос</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите голос" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ru-RU-Wavenet-A">
                          Русский (Женский A)
                        </SelectItem>
                        <SelectItem value="ru-RU-Wavenet-B">
                          Русский (Мужской B)
                        </SelectItem>
                        <SelectItem value="ru-RU-Wavenet-C">
                          Русский (Женский C)
                        </SelectItem>
                        <SelectItem value="ru-RU-Wavenet-D">
                          Русский (Мужской D)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="speakingRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Скорость речи: {field.value}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="2"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>От 0.5 до 2.0</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pitch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тон голоса: {field.value}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="-20"
                        max="20"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>От -20 до 20</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-semibold">Настройки AI</h3>

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Модель</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите модель" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gemini-1.5-pro">
                          Gemini 1.5 Pro
                        </SelectItem>
                        <SelectItem value="gemini-1.5-flash">
                          Gemini 1.5 Flash
                        </SelectItem>
                        <SelectItem value="gemini-2.0-flash-exp">
                          Gemini 2.0 Flash (Experimental)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Системный промпт</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Вы — голосовой ассистент..."
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormDescription>
                      Инструкции для AI агента
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature: {field.value}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Креативность ответов (0-2)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Макс. токенов</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="100"
                        min="100"
                        max="8000"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Максимальная длина ответа
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit">
                {agent ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
