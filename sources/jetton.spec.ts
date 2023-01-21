import { toNano, beginCell } from "ton-core";
import { ContractSystem } from "ton-emulator";
import {SampleJetton, SampleJetton_init} from './output/jetton_SampleJetton';

describe('jetton', () => {
    it('should deploy', async () => {

        // Create jetton
        let system = await ContractSystem.create();
        let owner = system.treasure('owner');

        let content = beginCell().storeUint(1, 16).storeSlice('fff').endCell();

        let contract = system.open(await SampleJetton.fromInit(owner.address, null));
        let tracker = system.track(contract.address);

        // Mint
        await contract.send(owner, { value: toNano(1) }, { $$type: 'Mint', amount: toNano(1000000) });
        await system.run();
        expect(tracker.events()).toMatchSnapshot();

        // Check owner
        expect((await contract.getOwner()).toString()).toEqual(owner.address.toString());

        // Data
        let data = await contract.getGetJettonData();
        // console.warn(data);
    });
});