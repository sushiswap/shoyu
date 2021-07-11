// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IERC721GovernanceToken {
    event SubmitSellProposal(uint256 id, uint256 snapshotId, address indexed from, uint256 power);
    event ConfirmSellProposal(uint256 id, address indexed from, uint256 power);
    event RevokeSellProposal(uint256 id, address indexed from, uint256 power);
    event ExecuteSellProposal(uint256 id);

    function initialize(
        address _factory,
        address _orderBook,
        address _nft,
        uint256 _tokenId,
        uint8 _minimumQuorum
    ) external;

    function factory() external view returns (address);

    function orderBook() external view returns (address);

    function nft() external view returns (address);

    function tokenId() external view returns (uint256);

    function minimumQuorum() external view returns (uint8);

    function proposals(uint256 index)
        external
        view
        returns (
            bool executed,
            address strategy,
            address currency,
            uint256 deadline,
            bytes memory params,
            uint256 expiration,
            uint256 snapshotId
        );

    function proposalsLength() external view returns (uint256);

    function totalPowerOf(uint256 id) external view returns (uint256);

    function powerOf(uint256 id, address account) external view returns (uint256);

    function mint(address account, uint256 amount) external;

    function claimPayout(uint256 id) external;

    function submitSellProposal(
        address strategy,
        address currency,
        uint256 deadline,
        bytes calldata params,
        uint256 expiration
    ) external;

    function confirmSellProposal(uint256 id) external;

    function revokeSellProposal(uint256 id) external;

    function executeSellProposal(uint256 id) external;
}
