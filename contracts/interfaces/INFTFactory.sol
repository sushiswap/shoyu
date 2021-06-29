// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface INFTFactory {
    event CreateNFT721(
        address indexed nft,
        string baseURI,
        string name,
        string symbol,
        address indexed owner,
        uint8 royaltyFee
    );
    event CreateNFT1155(address indexed nft, string uri, address indexed owner, uint8 royaltyFee);
    event Tag(address indexed nft, uint256 indexed tokenId, string indexed tag, uint256 tagNonce);

    function MAX_PROTOCOL_FEE() external view returns (uint8);

    function protocolFeeRecipient() external view returns (address);

    function protocolFee() external view returns (uint8);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function setProtocolFeeRecipient(address _protocolFeeRecipient) external;

    function setProtocolFee(uint8 _protocolFee) external;

    function setStrategyWhitelisted(address sale, bool whitelisted) external;

    function createNFT721(
        string calldata baseURI,
        string calldata name,
        string calldata symbol,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT721(address query) external view returns (bool result);

    function createNFT1155(string calldata uri, uint8 royaltyFee) external returns (address nft);

    function isNFT1155(address query) external view returns (bool result);

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        string[] memory tags
    ) external;

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        string[] memory tags
    ) external;

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external;

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] memory tags
    ) external;
}
