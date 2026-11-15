import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Check } from "lucide-react-native";
import { SOP_STEPS, completedSteps } from "@/lib/workshop";

/**
 * Horizontal 10-step SOP lifecycle indicator for a job card.
 * Completed steps are emerald, the current step is amber, Rejected is red.
 */
export function StepProgress({ job }: { job: any }) {
  const done = completedSteps(job);
  const rejected = job?.status === "Rejected";
  const closed = job?.status === "Closed";

  return (
    <View className="bg-[#121215] border border-[#27272A] p-3.5 rounded-2xl mb-3">
      <Text className="text-zinc-400 text-[10px] uppercase font-bold mb-2.5">
        Job Lifecycle — SOP Steps
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row items-start">
          {SOP_STEPS.map((label, i) => {
            const stepNo = i + 1;
            const isDone = stepNo <= done;
            const isCurrent = !closed && stepNo === done + 1;
            const isBlocked = rejected && stepNo === 4;
            return (
              <View key={label} className="flex-row items-start">
                <View className="items-center" style={{ width: 58 }}>
                  <View
                    className={`w-6 h-6 rounded-full items-center justify-center border ${
                      isBlocked
                        ? "bg-red-950 border-red-700"
                        : isDone
                        ? "bg-emerald-600 border-emerald-500"
                        : isCurrent
                        ? "bg-amber-500 border-amber-400"
                        : "bg-zinc-900 border-zinc-700"
                    }`}
                  >
                    {isDone && !isBlocked ? (
                      <Check color="#FFFFFF" size={12} />
                    ) : (
                      <Text
                        className={`text-[10px] font-bold ${
                          isBlocked ? "text-red-300" : isCurrent ? "text-black" : "text-zinc-400"
                        }`}
                      >
                        {stepNo}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`text-[9px] mt-1 text-center ${
                      isBlocked
                        ? "text-red-300 font-bold"
                        : isDone
                        ? "text-emerald-400"
                        : isCurrent
                        ? "text-amber-300 font-bold"
                        : "text-zinc-500"
                    }`}
                  >
                    {label}
                  </Text>
                </View>
                {stepNo < SOP_STEPS.length && (
                  <View
                    className={`h-0.5 mt-3 -mx-2 flex-1 ${stepNo < done ? "bg-emerald-700" : "bg-zinc-800"}`}
                    style={{ width: 14 }}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      {rejected && (
        <Text className="text-red-300 text-[11px] mt-2">
          Diagnosis rejected by the manager — the unit is returned / the card is closed off. A new
          diagnosis can be submitted if the manager asks for a re-inspection.
        </Text>
      )}
    </View>
  );
}
