
import asyncio
import websockets
import json

async def listen():
    uri = "ws://localhost:3001"
    while True:
        try:
            async with websockets.connect(uri) as websocket:
                while True:
                    try:
                        message = await websocket.recv()
                        log_data = json.loads(message)
                        print(f"[{log_data['type']}] {log_data['message']}")
                    except websockets.exceptions.ConnectionClosed:
                        print("Connection closed.")
                        break
                    except Exception as e:
                        print(f"An error occurred: {e}")
                        break
        except (OSError, websockets.exceptions.ConnectionClosedError):
            print("Connection failed. Retrying in 5 seconds...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(listen())
