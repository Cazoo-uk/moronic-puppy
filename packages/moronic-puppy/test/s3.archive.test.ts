import {Event, Loaded} from "../lib"
import {eventFrom} from "../lib/projector.cloud"

const record = (event: Loaded<Event>) => ({
    dynamodb:{
        Keys: {
           PK: {S: event.stream},
           SK: {N: event.sequence}
        },

        NewImage: {
            PK: {S: event.stream},
            SK: {N: event.sequence},
            ID: {S: event.id},
            TYPE: {S: event.type},
            DATA: {
                S: JSON.stringify(event.data)
            }
        }
    }
})

const archiveFile = (events: Array<Loaded<Event>>) =>
    events.map(e => JSON.stringify(record(e))).join('')



describe("When reading from an S3 archive", () => {
    it("should be cool", () => {
        const r = record({
            id: "abc123",
            stream: "foo",
            sequence: 3,
            type: "beep",
            data: {x: 1, y: 2}
        })
        console.log(r)
        console.log(eventFrom(r.dynamodb.NewImage))
    })
})
