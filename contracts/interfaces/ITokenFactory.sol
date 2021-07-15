// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface ITokenFactory {
    event CreateNFT721(
        address indexed nft,
        string name,
        string symbol,
        address indexed owner,
        uint256[] tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event CreateNFT721(
        address indexed proxy,
        string name,
        string symbol,
        address indexed owner,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event CreateNFT1155(
        address indexed proxy,
        address indexed owner,
        uint256[] tokenIds,
        uint256[] amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    );
    event CreateSocialToken(
        address indexed proxy,
        address indexed owner,
        string name,
        string symbol,
        address indexed dividendToken
    );
    event Tag(address indexed nft, uint256 indexed tokenId, string indexed tag, uint256 tagNonce);

    function MAX_ROYALTY_FEE() external view returns (uint8);

    function MAX_OPERATIONAL_FEE() external view returns (uint8);

    function baseURI721() external view returns (string memory);

    function baseURI1155() external view returns (string memory);

    function erc721Exchange() external view returns (address);

    function erc1155Exchange() external view returns (address);

    function protocolFeeInfo() external view returns (address recipient, uint8 permil);

    function operationalFeeInfo() external view returns (address recipient, uint8 permil);

    function isStrategyWhitelisted(address strategy) external view returns (bool);

    function setBaseURI721(string memory uri) external;

    function setBaseURI1155(string memory uri) external;

    function setProtocolFeeRecipient(address protocolFeeRecipient) external;

    function setOperationalFeeRecipient(address operationalFeeRecipient) external;

    function setOperationalFee(uint8 operationalFee) external;

    function setStrategyWhitelisted(address sale, bool whitelisted) external;

    function createNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint256[] calldata tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function createNFT721(
        string calldata name,
        string calldata symbol,
        address owner,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT721(address query) external view returns (bool result);

    function createNFT1155(
        address owner,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external returns (address nft);

    function isNFT1155(address query) external view returns (bool result);

    function createSocialToken(
        string memory name,
        string memory symbol,
        address dividendToken,
        address owner
    ) external returns (address proxy);

    function isSocialToken(address query) external view returns (bool result);

    function mintWithTags721(
        address nft,
        address to,
        uint256 tokenId,
        bytes calldata data,
        string[] calldata tags
    ) external;

    function mintWithTags1155(
        address nft,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data,
        string[] calldata tags
    ) external;

    function setTags721(
        address nft,
        uint256 tokenId,
        string[] calldata tags
    ) external;

    function setTags1155(
        address nft,
        uint256 tokenId,
        string[] calldata tags
    ) external;
}
