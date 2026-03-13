import { useEffect, useState } from "react";
import { useSocket } from "~/lib/useSocket";
import type { RoomListing } from "~/lib/types";
import { RoomCard } from "./RoomCard";

interface RoomBrowserProps {
  /** Called when the player clicks "Join Table" on a card. */
  onJoin: (code: string) => void;
  /** The code currently being joined (to show loading state on the right card). */
  joiningCode: string | null;
}

export function RoomBrowser({ onJoin, joiningCode }: RoomBrowserProps) {
  const socket = useSocket();
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Initial fetch
    socket.emit("rooms:subscribe", (initial: RoomListing[]) => {
      setRooms(initial);
      setLoaded(true);
    });

    // Real-time updates
    const onUpdated = (updated: RoomListing[]) => setRooms(updated);
    socket.on("rooms:updated", onUpdated);

    return () => {
      socket.off("rooms:updated", onUpdated);
    };
  }, [socket]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
          Public Rooms
        </h2>
        {loaded && (
          <span className="text-xs text-gray-600">
            {rooms.length === 0 ? "No rooms open" : `${rooms.length} room${rooms.length !== 1 ? "s" : ""} open`}
          </span>
        )}
      </div>

      {!loaded ? (
        <div className="text-center py-8 text-gray-600 text-sm">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-2xl py-10 text-center">
          <div className="text-3xl mb-3 select-none opacity-40">♠</div>
          <p className="text-gray-500 text-sm">No public rooms right now.</p>
          <p className="text-gray-600 text-xs mt-1">Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.code}
              room={room}
              onJoin={onJoin}
              joining={joiningCode === room.code}
            />
          ))}
        </div>
      )}
    </div>
  );
}
